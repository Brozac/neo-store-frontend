#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_swatch_flush.py — كيت 32 [swatch-flush]
════════════════════════════════════════════════════════════════════════════════
الطلب (المالك): «نحوس الحلقة تعود ملاصقة مكانش فجوة بيضة»

يعني: الحلقة الوردية كتلاصق الحدود مباشرة — بلا ring-offset-1/ring-offset-white
(الفجوة البيضاء اللي كانت بين الحدود والحلقة كتلف).

الحالة النهائية (الهدف) فكارت اللائحة:
  الشكل:  w-5 h-5 rounded-full overflow-hidden border transition-all duration-150 cursor-pointer p-0
  الحلقة: border-[#FF6B9D] ring-2 ring-[#FF6B9D]
          (حدود وردية 1px + حلقة وردية 2px ملاصقة = هالة وردية صافية 3px)

السكريبت كيوصل للهدف من أي حالة معروفة (كيتلقى تلقائياً):
  A) v3.1 الأصلي:      دائرية ماشي + حلقة داكنة + فجوة بيضاء
     «w-5 h-5 rounded-md …» + «border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white»
  B) بعد كيت 31:       دائرية + حلقة وردية + فجوة بيضاء
     «border-[#FF6B9D] ring-2 ring-[#FF6B9D] ring-offset-1 ring-offset-white»
  C) يدوي:             حلقة داكنة ملاصقة بلا فجوة
     «border-temu-black ring-2 ring-temu-black»
  D) الهدف (ملاصقة وردية) = NOTHING TO DO

المنهجية (نفس عائلة 29/30/31):
  · fail-closed: غير ProductCard.tsx (app/components ولا src/app/components)
    + ماركر aria-pressed لازم يكون — أي شك = ما كيدير والو + diag .txt
  · backup: ProductCard.tsx.bak-kit32 (أول نسخة كتبقى)
  · idempotent · --check · pure-stdlib · CRLF/LF محفوظين
════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CARD = "ProductCard.tsx"
BACKUP_SUFFIX = ".bak-kit32"
DIAG_SUFFIX = ".kit32-diag.txt"

REQUIRED_MARKERS = ("aria-pressed",)

# ── الشكل (كيف كيت 31) ──
SHAPE_OLD = "w-5 h-5 rounded-md overflow-hidden border transition-all duration-150 cursor-pointer p-0"
SHAPE_NEW = "w-5 h-5 rounded-full overflow-hidden border transition-all duration-150 cursor-pointer p-0"

# ── الحلقة: حالات قديمة معروفة → هدف واحد ملاصق ──
# ⚠️ الترتيب مصّحّ: من الأطول للأقصر (بعضهم بادئات تاع بعضهم):
#    OLD3 «داكن ملاصق» هو بادئة تاع OLD1، وRING_NEWS هو بادئة تاع OLD2 —
#    الفحص بالترتيب هذا كيمنع بقايا ring-offset معلقين بعد الترقيع.
RING_NEWS = "border-[#FF6B9D] ring-2 ring-[#FF6B9D]"
RING_OLDS = {
    "v3.1 داكنة+فجوة": "border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white",
    "كيت31 وردية+فجوة": "border-[#FF6B9D] ring-2 ring-[#FF6B9D] ring-offset-1 ring-offset-white",
    "داكنة ملاصقة (يدوي)": "border-temu-black ring-2 ring-temu-black",
}


def find_targets():
    roots = []
    for base in (os.getcwd(), os.path.dirname(os.path.abspath(__file__))):
        if base and base not in roots and os.path.isdir(base):
            roots.append(base)
    for base in list(roots):
        parent = os.path.dirname(base)
        if parent and parent not in roots and os.path.isdir(parent):
            roots.append(parent)

    found = []
    for root in roots:
        for parts in (("app", "components"), ("src", "app", "components")):
            comp = os.path.join(root, *parts)
            p = os.path.join(comp, CARD)
            if os.path.isfile(p) and p not in found:
                found.append(p)
    return found


def ring_state(text):
    """OLD (الأطول أولاً) قبل NEW — لأن RING_NEWS بادئة تاع OLD2 والقديمة تاع بعضها."""
    for name, s in RING_OLDS.items():
        if s in text:
            return "OLD", name, s
    if RING_NEWS in text:
        return "NEW"
    return "UNKNOWN"


def check_file(path):
    with open(path, "rb") as f:
        raw = f.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return {"path": path, "state": "UNKNOWN", "why": "الماشي UTF-8", "raw": raw}

    for m in REQUIRED_MARKERS:
        if m not in text:
            return {
                "path": path, "state": "UNKNOWN",
                "why": f"ماركر «{m}» ماكانش — هذا ماشي كارت كيت 30 (v3.x)",
                "raw": raw, "text": text,
            }

    shape = "OLD" if SHAPE_OLD in text else ("NEW" if SHAPE_NEW in text else "UNKNOWN")
    r = ring_state(text)
    if shape == "UNKNOWN" or r == "UNKNOWN":
        return {
            "path": path, "state": "UNKNOWN",
            "why": f"شكل={shape} · حلقة={r if r == 'UNKNOWN' else r[0]} — سلسلة معروفة مالقيتهاش",
            "raw": raw, "text": text,
        }

    if shape == "NEW" and r == "NEW":
        return {"path": path, "state": "PATCHED", "raw": raw}
    return {"path": path, "state": "PARTIAL", "shape": shape, "ring": r, "raw": raw}


def write_diag(path, info):
    diag = path + DIAG_SUFFIX
    lines = [
        "كيت 32 [swatch-flush] — تقرير تشخيصي (ماشي ملف كود — يمسح براحتك)",
        "=" * 70,
        f"الملف: {path}",
        f"السبب: {info.get('why', '?')}",
        "",
        "الهدف:",
        f"  [شكل]  {SHAPE_NEW}",
        f"  [حلقة] {RING_NEWS}",
        "الحالات المعروفة اللي كيتقبلها السكريبت:",
    ]
    for name, s in RING_OLDS.items():
        lines.append(f"  · {name}: {s}")
    lines += ["", "السطور المرتبطة فملفك الحالي:", "-" * 70]
    text = info.get("text")
    if text is None:
        try:
            text = info["raw"].decode("utf-8", errors="replace")
        except Exception:
            text = ""
    if text:
        n = 0
        for i, line in enumerate(text.splitlines(), 1):
            if any(k in line for k in ("rounded-md", "rounded-full", "ring-", "aria-pressed")):
                lines.append(f"{i:5d} | {line.strip()[:200]}")
                n += 1
                if n >= 40:
                    lines.append("… (مقطوع عند 40 سطر)")
                    break
    with open(diag, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return diag


def patch_file(path):
    info = check_file(path)
    st = info["state"]

    if st == "PATCHED":
        print(f"   ⏭  {path}")
        print("      دايماً فالحالة النهائية (دائرية + حلقة وردية ملاصقة). ✅")
        return 0

    if st == "UNKNOWN":
        print(f"   ⚠ {path}")
        print(f"      {info['why']}")
        diag = write_diag(path, info)
        print(f"      📄 التشخيص: {diag}  (امتداد .txt — ماكيضرش البناء)")
        print("      → الملف ما تلمسش. شوف التشخيص قبل إعادة المحاولة.")
        return 1

    text = info["raw"].decode("utf-8")
    new_text = text
    did = []
    if info["shape"] == "OLD":
        new_text = new_text.replace(SHAPE_OLD, SHAPE_NEW)
        did.append("الشكل: دائري (rounded-full)")
    r = info["ring"]
    if r[0] == "OLD":
        name, old_s = r[1], r[2]
        new_text = new_text.replace(old_s, RING_NEWS)
        did.append(f"الحلقة: {name} → وردية ملاصقة #FF6B9D (بلا فجوة بيضاء)")

    if not did:
        print(f"   ⏭  {path} — والو باش يدير")
        return 0

    backup = path + BACKUP_SUFFIX
    if not os.path.exists(backup):
        with open(backup, "wb") as f:
            f.write(info["raw"])
        print(f"   💾 تراجع: {backup}")

    with open(path, "wb") as f:
        f.write(new_text.encode("utf-8"))

    print(f"   ✅ {path}")
    for d in did:
        print(f"      · {d}")
    return 0


def main():
    mode = "--check" if "--check" in sys.argv else "patch"
    print("─" * 62)
    if mode == "--check":
        print("كيت 32 [swatch-flush] — فحص الحالة (--check · بلا كتابة)")
    else:
        print("كيت 32 [swatch-flush] — حلقة وردية ملاصقة (بلا فجوة بيضاء)")
    print("─" * 62)

    targets = find_targets()
    if not targets:
        print(f"⚠ ما لقيتش {CARD} فـ app/components ولا src/app/components.")
        print("  حل الزيب فجذر الفرونت (جنب package.json) ولا فمجلد داخلو، وعاود.")
        return 1

    rc = 0
    for p in targets:
        if mode == "--check":
            info = check_file(p)
            st = info["state"]
            extra = ""
            if st == "PARTIAL":
                r = info["ring"]
                rr = r[1] if r[0] == "OLD" else r
                extra = f" (شكل={info['shape']} · حلقة={rr})"
            if st == "UNKNOWN":
                extra = f" — {info.get('why')}"
            print(f"   {p} → {st}{extra}")
        else:
            rc |= patch_file(p)

    print("─" * 62)
    if mode == "patch" and rc == 0:
        print("✔ المرحلة الجاية:  npm run build  →  deploy")
        print("  التراجع: انسخ .bak-kit32 فوق ProductCard.tsx")
    print("─" * 62)
    return rc


if __name__ == "__main__":
    sys.exit(main())
