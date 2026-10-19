#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
direct_patch_s3_page_dedupe.py — Laclarc Section 3 (dedupe المرحلة 2)

السياق:
  verify_jsonld_fix.py --file .next/server/app/index.html → [2] FAIL: بلوكات = 2
  كاملين @graph متطابقين. الـ repro المحلي (Next 15 + Next 16 + نفس المكون)
  كيخرج بلوك واحد بالضبط → إذن التكرار مصدره كود مشروعك: غالباً سكريبت
  ld+json قديم باقٍ فـ app/page.tsx (لصق يدوي أو محاولة قبلية) جنب
  <SiteJsonLd />.

شنو كيدير هاد السكريبت:
  [SCAN]   كيقلب app/ + components/ + lib/ كاملين على application/ld+json
           (report فقط — ما كيبدل والو فهاد الملفات)
  [PLAN]   فـ app/page.tsx:
           · كيمسح كول <script ... application/ld+json ...> JSX (القديم)
           · كيمسح consts يتيمة وليّاو بلا استعمال (jsonLd / jsonLdString)
             + التعليقات اللي فوقهم
           · كيخلي <SiteJsonLd /> واحد بالضبط (كيمسح الزيادة إلا كان)
  [GUARDS] إلا من بعد التنظيف usage ديال SiteJsonLd = 0 → ABORT (exit 2)
           إلا import SiteJsonLd ما كاينش أصلاً → ABORT مع التوجيه
           الأقواس خاصها تظل متوازنة · ما كتب والو قبل --apply

الاستعمال (من جذر الفرونت):
  python direct_patch_s3_page_dedupe.py             # dry-run + تقرير SCAN
  python direct_patch_s3_page_dedupe.py --apply     # تنظيف + backup
  python direct_patch_s3_page_dedupe.py --scan-only # التقرير بلا PLAN طويل

Exit codes: 0 = نجاح/idempotent · 1 = I/O · 2 = guard/باترن (ما كتب والو)
"""
import codecs
import os
import re
import shutil
import sys

TARGET_DEFAULT = os.path.join("app", "page.tsx")
BACKUP_SUFFIX = ".bak-jsonldfix"
SCAN_DIRS = ("app", "components", "lib")
SCAN_EXTS = (".ts", ".tsx", ".jsx", ".js")
SCAN_SKIP = {".next", "node_modules", ".git"}

TAG_RE = re.compile(r"<script\b", re.I)
LD_MARKER = re.compile(r"application/ld\+json", re.I)
CLOSE_TAG_RE = re.compile(r"</script\s*>", re.I)
CONST_RE = re.compile(r"\bconst\s+(jsonLd\w*)\b")
IMPORT_RE = re.compile(
    r"import\s+SiteJsonLd\s+from\s+['\"]@/components/site-jsonld['\"]\s*;?"
)
USAGE_RE = re.compile(r"<SiteJsonLd\b[^<>]*?/?>")


# ─── I/O (BOM + CRLF safe — نفس العائلة ديال الباتشرات السابقين) ───────
def load_text(path):
    with open(path, "rb") as f:
        raw = f.read()
    bom = raw.startswith(codecs.BOM_UTF8)
    if bom:
        raw = raw[len(codecs.BOM_UTF8):]
    crlf = b"\r\n" in raw
    text = raw.decode("utf-8").replace("\r\n", "\n")
    return text, bom, crlf


def save_text(path, text, bom, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    data = text.encode("utf-8")
    if bom:
        data = codecs.BOM_UTF8 + data
    with open(path, "wb") as f:
        f.write(data)


# ─── String-aware scanning ──────────────────────────────────────────────
def compute_string_mask(text):
    """1 = الحرف داخل string / template / comment — ماشي كود."""
    n = len(text)
    mask = bytearray(n)
    i = 0
    quote = None
    while i < n:
        ch = text[i]
        if quote:
            mask[i] = 1
            if ch == "\\":
                if i + 1 < n:
                    mask[i + 1] = 1
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            mask[i] = 1
            i += 1
            continue
        if ch == "/":
            nxt = text[i + 1] if i + 1 < n else ""
            if nxt == "/":
                j = text.find("\n", i)
                end = n if j < 0 else j
                for k in range(i, end):
                    mask[k] = 1
                i = end
                continue
            if nxt == "*":
                j = text.find("*/", i + 2)
                end = n if j < 0 else j + 2
                for k in range(i, min(end, n)):
                    mask[k] = 1
                i = end
                continue
        i += 1
    return mask


def in_mask(mask, start, end):
    return 1 in mask[start:end]


def find_tag_end(text, start):
    """من '<script' حتى '>' خارج quotes وبرا {} — ترجع (end, self_closing).
    ترجع None إلا ما تسالنش التاغ (ملف مقطوع)."""
    i = start
    n = len(text)
    quote = None
    depth = 0  # أقواس {} جوّا تعبيرات JSX attributes
    while i < n:
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == ">" and depth == 0:
            self_closing = text[i - 1] == "/"
            return i + 1, self_closing
        i += 1
    return None


def find_script_blocks(text):
    """كل بلوكات <script> فيهم application/ld+json — برا النصوص.
    ترجع list ديال (start, end, line, kind)."""
    mask = compute_string_mask(text)
    blocks = []
    for m in TAG_RE.finditer(text):
        if in_mask(mask, m.start(), m.start() + len(m.group(0))):
            continue
        tag = find_tag_end(text, m.start())
        if tag is None:
            continue
        tag_end, self_closing = tag
        tag_text = text[m.start():tag_end]
        if not LD_MARKER.search(tag_text):
            continue
        if self_closing:
            end = tag_end
            kind = "self-closing JSX"
        else:
            cm = CLOSE_TAG_RE.search(text, tag_end)
            if cm is None:
                continue
            end = cm.end()
            kind = "children JSX"
        line = text.count("\n", 0, m.start()) + 1
        blocks.append((m.start(), end, line, kind))
    return blocks


def statement_end(text, start):
    """من بداية قيمة تعيين (=) حتى آخر الحرفة: block {} كامل أو ; فالعمق 0.
    string-aware. ترجع offset مورا النهاية، ولا None."""
    i = start
    n = len(text)
    quote = None
    depth = 0
    while i < n:
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch == "/":
            nxt = text[i + 1] if i + 1 < n else ""
            if nxt == "/":
                i = n if text.find("\n", i) < 0 else text.find("\n", i)
                continue
            if nxt == "*":
                j = text.find("*/", i + 2)
                i = n if j < 0 else j + 2
                continue
        if ch in "{([":
            depth += 1
        elif ch in "})]":
            depth -= 1
            if depth == 0 and ch == "}":
                # block object سالا — كمل حتى ; ولا سالا السطر
                j = i + 1
                while j < n and text[j] in " \t":
                    j += 1
                if j < n and text[j] == ";":
                    return j + 1
                return i + 1
            if depth < 0:
                return None
        elif ch == ";" and depth == 0:
            return i + 1
        i += 1
    return None


def remove_spans(text, spans):
    """spans = [(start,end,label,line)] مرتبين تنازلياً — كيحيد وكيطيح الأسطر الخاويين المتجاورين."""
    for start, end, label, line in sorted(spans, key=lambda s: -s[0]):
        # حيد الأسطر الخاوية اللي مورا البلوك إلا كانت ملاصقة
        while end < len(text) and text[end] == "\n" and (
            end + 1 >= len(text) or text[end + 1] == "\n"
        ):
            end += 1
        text = text[:start] + text[end:]
    return text


def strip_comment_lines_above(lines, idx):
    start = idx
    while start > 0 and lines[start - 1].strip().startswith("//"):
        start -= 1
    return start


def collapse_blank_lines(text):
    return re.sub(r"\n{3,}", "\n\n", text)


# ─── المرحلة 2: consts يتيمة ────────────────────────────────────────────
def find_assign_at_depth0(text, start, mask):
    """من مورا اسم const حتى أول '=' فالعمق 0 وبرا النصوص (يتجنب : Type و == و strings).
    ترجع offset ديال '=', ولا -1."""
    i = start
    n = len(text)
    depth = 0
    while i < n:
        if mask[i]:
            i += 1
            continue
        ch = text[i]
        if ch in "{([":
            depth += 1
        elif ch in "})]":
            depth -= 1
            if depth < 0:
                return -1
        elif ch == "=" and depth == 0:
            if i + 1 < n and text[i + 1] == "=":
                i += 2
                continue
            return i
        elif ch == ";":
            return -1
        i += 1
    return -1


def remove_orphan_consts(text):
    """كيعاود حتى يستاقر: const اللي ما بقى حتى استعمال ليه كيتحيد.
    ترجع (text, removed_spans_info)."""
    removed = []
    changed = True
    while changed:
        changed = False
        mask = compute_string_mask(text)
        for m in CONST_RE.finditer(text):
            if in_mask(mask, m.start(), m.end()):
                continue
            name = m.group(1)
            eq = find_assign_at_depth0(text, m.end(), mask)
            if eq < 0:
                continue
            vstart = eq + 1
            while vstart < len(text) and text[vstart] in " \t":
                vstart += 1
            end = statement_end(text, vstart)
            if end is None:
                continue
            # الاستعمالات الأخرى (برا الـ declaration نفسها)
            others = [
                u for u in re.finditer(r"\b%s\b" % re.escape(name), text)
                if not (u.start() >= m.start() and u.end() <= end)
            ]
            others = [u for u in others if not in_mask(mask, u.start(), u.end())]
            if others:
                continue  # باقى كيتستعمل — نخليه
            line = text.count("\n", 0, m.start()) + 1
            # حيد التعليقات اللي فوق
            lines = text.split("\n")
            decl_line_idx = text.count("\n", 0, m.start())
            new_first = strip_comment_lines_above(lines, decl_line_idx)
            span_start = len("\n".join(lines[:new_first])) + (
                1 if new_first > 0 else 0
            )
            removed.append((span_start, end, "const %s (يتيم)" % name, line))
            text = remove_spans(text, [(span_start, end, "", line)])
            text = collapse_blank_lines(text)
            changed = True
            break
    return text, removed


# ─── Core ───────────────────────────────────────────────────────────────
def build_cleaned(text, force=False):
    """ترجع (cleaned, report, errors) — errors ما خاوية = ما كتب والو."""
    report, errors = [], []

    blocks = find_script_blocks(text)
    uses = [
        u
        for u in USAGE_RE.finditer(text)
        if not in_mask(compute_string_mask(text), u.start(), u.end())
    ]
    has_import = bool(IMPORT_RE.search(text))

    if not blocks and len(uses) <= 1 and has_import:
        return text, ["[OK] idempotent — ما كاين حتى سكريبت قديم و usage واحد"], []

    if blocks:
        for s, e, line, kind in blocks:
            report.append(
                "   مسح: <script ld+json> (%s) — سطر %d (%d حرف)"
                % (kind, line, e - s)
            )
        text = remove_spans(text, [(s, e, "", l) for s, e, l, _ in blocks])
        text = collapse_blank_lines(text)

    # consts يتيمة (من بعد ما حيدنا السكريبتات اللي كانو كيستعملوهم)
    text, removed_consts = remove_orphan_consts(text)
    for s, e, label, line in removed_consts:
        report.append("   مسح: %s — سطر %d" % (label, line))

    # <SiteJsonLd /> واحد بالضبط
    mask = compute_string_mask(text)
    uses = [u for u in USAGE_RE.finditer(text) if not in_mask(mask, u.start(), u.end())]
    if len(uses) > 1:
        for u in uses[1:]:
            line = text.count("\n", 0, u.start()) + 1
            report.append("   مسح: <SiteJsonLd /> زايدة — سطر %d" % line)
        text = remove_spans(
            text, [(u.start(), u.end(), "", 0) for u in uses[1:]]
        )
        text = collapse_blank_lines(text)
    elif len(uses) == 0:
        if blocks and not force:
            errors.append(
                "من بعد التنظيف usage ديال <SiteJsonLd /> = 0 — "
                "شغّل أولاً: python direct_patch_home_jsonld.py (dry-run ثم --apply)"
            )
        elif force:
            report.append("   ⚠ --force: بلا <SiteJsonLd /> — الصفحة بلا JSON-LD!")

    if not IMPORT_RE.search(text) and not errors:
        errors.append(
            "import SiteJsonLd ما كاينش فـ page.tsx — "
            "شغّل أولاً: python direct_patch_home_jsonld.py"
        )

    # guards نهائية (الأقواس كيتحسبو برا النصوص — strings فيها braces عاديين)
    if not errors:
        mask = compute_string_mask(text)
        ob = sum(1 for i, ch in enumerate(text) if ch == "{" and not mask[i])
        cb = sum(1 for i, ch in enumerate(text) if ch == "}" and not mask[i])
        if ob != cb:
            errors.append("GUARD: الأقواس {} ماشي متوازنين بعد التعديل (%d مقابل %d)" % (ob, cb))
        if find_script_blocks(text):
            errors.append("GUARD: بقا سكريبت ld+json من بعد التنظيف")
        n_uses = len(
            [u for u in USAGE_RE.finditer(text) if not in_mask(mask, u.start(), u.end())]
        )
        if not errors and n_uses != 1:
            errors.append("GUARD: usage ديال SiteJsonLd = %d (متوقع 1)" % n_uses)

    return text, report, errors


# ─── SCAN: أين كاين ld+json فالمشروع؟ ───────────────────────────────────
def scan_repo():
    hits = []
    for base in SCAN_DIRS:
        if not os.path.isdir(base):
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in SCAN_SKIP]
            for fn in files:
                if not fn.endswith(SCAN_EXTS):
                    continue
                p = os.path.join(root, fn)
                try:
                    with open(p, "rb") as f:
                        t = f.read().decode("utf-8", "replace")
                except OSError:
                    continue
                if LD_MARKER.search(t):
                    lines = [
                        i + 1
                        for i, ln in enumerate(t.split("\n"))
                        if LD_MARKER.search(ln)
                    ]
                    hits.append((p.replace("\\", "/"), lines))
    return hits


# ─── main ───────────────────────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    apply = "--apply" in args
    scan_only = "--scan-only" in args
    force = "--force" in args
    target = TARGET_DEFAULT
    for a in args:
        if a.endswith((".tsx", ".ts")) and not a.startswith("--"):
            target = a

    print("═" * 60)
    print("🔍 LACLARC S3 — PAGE JSON-LD DEDUPE")
    print("═" * 60)

    hits = scan_repo()
    print("[SCAN] ملفات فيها application/ld+json:")
    if not hits:
        print("   (حتى واحد)")
    for p, lines in hits:
        marker = " ← target" if p.replace("/", os.sep) == target else ""
        print("   · %s — أسطر %s%s" % (p, lines, marker))
    print()

    if scan_only:
        return 0

    if not os.path.isfile(target):
        print("[ERROR] ملف ما كاينش: %s — شغّلو من جذر الفرونت" % target)
        return 1

    text, bom, crlf = load_text(target)
    cleaned, report, errors = build_cleaned(text, force=force)

    if errors:
        print("[ERROR] ما كتب والو:")
        for e in errors:
            print("   " + e)
        return 2

    idempotent = any("idempotent" in r for r in report)
    print("[PLAN] %s" % target)
    for r in report:
        print(r)
    if idempotent:
        print()
        print("[NEXT] إلا التقرير ديال [SCAN] ورّى ملفات أخرى فيها ld+json —")
        print("       صيفط لي التقرير كامل قبل أي خطوة.")
        return 0
    if not apply:
        print()
        print("[DRY-RUN] ما كتب والو — عاود بـ --apply (+backup %s)" % BACKUP_SUFFIX)
        return 0

    backup = target + BACKUP_SUFFIX
    shutil.copyfile(target, backup)
    save_text(target, cleaned, bom, crlf)
    print()
    print("[APPLIED] ✓ backup: %s" % backup)
    print("[NEXT] npm run build → verify_jsonld_fix.py --file .next\\server\\app\\index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
