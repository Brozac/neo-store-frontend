#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
direct_patch_layout_jsonld_remove.py — Laclarc Section 3 HOTFIX (الخطوة 1/2)

علاش؟
  Google Rich Results Test كيشوف OnlineStore مرتين متطابقين. السبب:
  الـ JSON-LD لي كيترندر من Server Component فالـ layout كيتكتب مرتين
  فالإخراج (HTML + RSC payload/self.__next_f) → Google كيحسبو جوج.
  (موثّق: vercel/next.js discussion #66896)
  + الزهد المعماري: schema ديال المتجر ما خاصوش يتكرر فـ 74,548 صفحة.

شنو كيتمسح من app/layout.tsx:
  [A] التعليقات + const jsonLd = {...};            (balanced-brace scan)
  [B] التعليقات + const jsonLdString = ...;         (سطر واحد)
  [C] التعليق + <script type="application/ld+json" ... />  (JSX multiline)
  ✅ SITE_URL و metadata كاملين كيبقاو (كيستعملهم metadataBase)

الاستعمال (من جذر الفرونت):
  python direct_patch_layout_jsonld_remove.py             # dry-run (بلا كتابة)
  python direct_patch_layout_jsonld_remove.py --apply     # كتابة + backup
  python direct_patch_layout_jsonld_remove.py --fullfile  # نفس --apply

Exit codes: 0 = نجاح (ولا "ما كاين ما يتصاوب") · 1 = I/O · 2 = الباترن ما تلقاش
"""
import codecs
import os
import re
import shutil
import sys

TARGET_DEFAULT = os.path.join("app", "layout.tsx")
BACKUP_SUFFIX = ".bak-jsonldfix"

# ─── Line-ending / BOM safe I/O ─────────────────────────────────────
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


# ─── String-aware balanced-brace scanner (نفس روح direct_patch_home_seo) ──
def scan_braced_block(text, start):
    """start = offset of the '{'. Return offset AFTER matching '}'.
    يتعقب ' " ` strings (بالـ escape) — الأقواس جوّا النصوص ما كيتحسبوش."""
    i = start
    n = len(text)
    depth = 0
    quote = None
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
            if nxt == "/":  # line comment
                j = text.find("\n", i)
                i = n if j < 0 else j
                continue
            if nxt == "*":  # block comment
                j = text.find("*/", i + 2)
                i = n if j < 0 else j + 2
                continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1  # unbalanced


def strip_comment_lines_above(lines, idx):
    start = idx
    while start > 0 and lines[start - 1].strip().startswith("//"):
        start -= 1
    return start


def collapse_blank_lines(text):
    return re.sub(r"\n{3,}", "\n\n", text)


# ─── Core removal ───────────────────────────────────────────────────
def build_cleaned(text):
    """Return (cleaned_text, report_lines) or (None, errors)."""
    report = []
    lines = text.split("\n")

    # [A] const jsonLd = { ... };
    idx_a = None
    for i, ln in enumerate(lines):
        if re.match(r"^const jsonLd = \{", ln):
            idx_a = i
            break
    if idx_a is None:
        return None, ["[A] const jsonLd = { ... } ما تلقاش"]

    offset_a = len("\n".join(lines[:idx_a])) + (1 if idx_a else 0)
    brace_off = text.find("{", offset_a)
    end_off = scan_braced_block(text, brace_off)
    if end_off < 0:
        return None, ["[A] الأقواس ماشي متوازنين فـ const jsonLd"]
    # semi-colon after closing brace?
    m = re.match(r"\s*;", text[end_off:])
    if m:
        end_off += m.end()
    a_start_line = strip_comment_lines_above(lines, idx_a)
    a_end_line = text.count("\n", 0, end_off)  # line index containing block end
    report.append("[A] مسح: const jsonLd = {...} (+تعليقات) — سطور %d-%d" % (a_start_line + 1, a_end_line + 1))

    # [B] const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    idx_b = None
    for i, ln in enumerate(lines):
        if "const jsonLdString = JSON.stringify(jsonLd).replace(/</g" in ln:
            idx_b = i
            break
    if idx_b is None:
        return None, ["[B] const jsonLdString ما تلقاش"]
    b_start = strip_comment_lines_above(lines, idx_b)
    report.append("[B] مسح: const jsonLdString (+تعليقات FIX-ESCAPE) — سطور %d-%d" % (b_start + 1, idx_b + 1))

    # [C] <script type="application/ld+json" ... jsonLdString ... />
    jsx_re = re.compile(
        r"<script(?=[^>]*type=\"application/ld\+json\")(?=[^>]*jsonLdString)[^>]*/>",
        re.S,
    )
    m_c = jsx_re.search(text)
    if not m_c:
        # non-self-closing variant
        jsx_re2 = re.compile(
            r"<script(?=[^>]*type=\"application/ld\+json\")(?=[^>]*jsonLdString)[^>]*>.*?</script>",
            re.S,
        )
        m_c = jsx_re2.search(text)
    if not m_c:
        return None, ["[C] <script ld+json> JSX ما تلقاش"]
    c_line = text.count("\n", 0, m_c.start())
    lines_c = text.split("\n")
    c_start = strip_comment_lines_above(lines_c, c_line)
    c_end = text.count("\n", 0, m_c.end())
    report.append("[C] مسح: <script application/ld+json> JSX — سطور %d-%d" % (c_start + 1, c_end + 1))

    # rebuild: mark ranges for deletion (0-based, inclusive)
    kills = [(a_start_line, a_end_line), (b_start, idx_b), (c_start, c_end)]
    kill_set = set()
    for s, e in kills:
        kill_set.update(range(s, e + 1))
    kept = [ln for i, ln in enumerate(lines) if i not in kill_set]
    out = "\n".join(kept)
    out = collapse_blank_lines(out)

    # guards
    checks = [
        ("application/ld+json" not in out, "بقا ld+json فالملف"),
        ("jsonLdString" not in out, "بقا jsonLdString (مرجع مكسور)"),
        ("const jsonLd =" not in out, "بقا const jsonLd"),
        ("SITE_URL" in out, "SITE_URL تحيّد بالغلط (خاصو يبقى للـ metadata)"),
        ("export const metadata" in out, "metadata تحيّدت بالغلط"),
        ("export default function RootLayout" in out, "RootLayout تحيّد بالغلط"),
        (out.count("{") == out.count("}"), "الأقواس ماشي متوازنين من بعد المسح"),
    ]
    errors = ["GUARD: " + msg for ok, msg in checks if not ok]
    if errors:
        return None, errors
    return out, report


def main():
    args = [a for a in sys.argv[1:]]
    apply = ("--apply" in args) or ("--fullfile" in args)
    target = TARGET_DEFAULT
    for a in args:
        if a.endswith((".tsx", ".ts")) and not a.startswith("--"):
            target = a

    if not os.path.isfile(target):
        print("[ERROR] ملف ما كاينش: %s" % target)
        print("        شغّلو من جذر الفرونت (المجلد لي فيه app/)")
        return 1

    text, bom, crlf = load_text(target)

    has_blocks = (
        "application/ld+json" in text
        or "jsonLdString" in text
        or "const jsonLd =" in text
    )
    looks_like_layout = "export default function RootLayout" in text

    if not has_blocks:
        if looks_like_layout:
            print("[OK] idempotent — layout نظيف من قبل (ما كاين لا ld+json لا jsonLd)")
            return 0
        print("[ERROR] هاد الملف ما فيهش لا JSON-LD ديالنا ولا RootLayout")
        print("        واش صاحب الملف صحيح؟ المتوقع: app/layout.tsx ديال الفرونت")
        return 2

    cleaned, msgs = build_cleaned(text)
    if cleaned is None:
        print("[ERROR] الباترن ما تطابقش — ما كتبت والو:")
        for m in msgs:
            print("   " + m)
        print("        إلا تبدل الملف بيدك، طبق التعديلات يدوياً (شوف README)")
        return 2

    print("[PLAN] %s" % target)
    for m in msgs:
        print("   " + m)
    print("   الحجم: %d → %d حرف" % (len(text), len(cleaned)))

    if not apply:
        print("[DRY-RUN] ما كتب والو — عاود بـ --apply باش تكتب (+backup %s)" % BACKUP_SUFFIX)
        return 0

    backup = target + BACKUP_SUFFIX
    shutil.copyfile(target, backup)
    save_text(target, cleaned, bom, crlf)
    print("[APPLIED] ✓ backup: %s" % backup)
    print("[NEXT] الخطوة 2/2: python direct_patch_home_jsonld.py --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
