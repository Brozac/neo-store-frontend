#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_swatch_gradient.py — كيت 33 [swatch-gradient]
════════════════════════════════════════════════════════════════════════════════
الطلب (المالك): «ديرها لون وردي متدرج هالة»

الحلقة النشيطة للسواتش تولّي **هالة وردية متدرجة**:
  · تدرج من #FF6B9D (الوردي الرسمي) إلى #e11d48 (rose-600)
    = نفس قرانيت زر الشراء تاع صفحة المنتج (from-[#FF6B9D] to-rose-600)
  · ملاصقة على الصورة (بلا فجوة بيضاء — زيدتها كيت 32)
  + توهج وردي خفيف (هالة) shadow-[0_0_6px_1px_rgba(255,107,157,0.30)]

التقنية (مجرّبة على Tailwind v4 حقيقي قبل التسليم):
  الحدود تولي 2px شفافة فالجزء الثابت، والتدرج كيبان من خلفية
  border-box — مناعة كاملة على مصارعة الكسكاد مع .border:
    ثابت:  w-5 h-5 rounded-full overflow-hidden border-2 border-transparent …
    نشيط:  [background:linear-gradient(#fff,#fff)_padding-box,
            linear-gradient(135deg,#FF6B9D,#e11d48)_border-box]
           shadow-[0_0_6px_1px_rgba(255,107,157,0.30)]
  (بدايل التقنية B «after-pseudo» مرفوضة: overflow-hidden كيقصها —
   والدليل موثق فـ scripts/kit33_sandbox/techniques.png)

الخوامل الرماديين: كيتحولو لحدود رمادية 2px (border-2 فالثابت) —
نفس لغة سواتشات صفحة المنتج (border-2 gray-200).

السكريبت كيوصل للهدف من أي حالة معروفة:
  A) v3.1 خام (مربع+داكن+فجوة) · B) كيت31 (وردية+فجوة)
  C) كيت32 (وردية ملاصقة) · D) يدوي (داكن ملاصق) · E) الهدف=NOTHING TO DO

المنهجية (عائلة 29→33): fail-closed + ماركر aria-pressed + backup .bak-kit33
+ diag .txt (عمداً ماشي .tsx) + idempotent + --check + CRLF محفوظ.
════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CARD = "ProductCard.tsx"
BACKUP_SUFFIX = ".bak-kit33"
DIAG_SUFFIX = ".kit33-diag.txt"

REQUIRED_MARKERS = ("aria-pressed",)

# ── الشكل/الثابت: 3 حالات (فحص الجديد أولاً — ماكاش فخ بادئات هنا) ──
SHAPE_NEWS = ("w-5 h-5 rounded-full overflow-hidden border-2 border-transparent "
              "transition-all duration-150 cursor-pointer p-0")
SHAPE_OLDS = [
    ("كيت31/32 (دائري + border عادي)",
     "w-5 h-5 rounded-full overflow-hidden border transition-all duration-150 cursor-pointer p-0"),
    ("v3.1 (مربع مضبّب)",
     "w-5 h-5 rounded-md overflow-hidden border transition-all duration-150 cursor-pointer p-0"),
]

# ── الحلقة/النشيط: فحص الأطول أولاً (بعضهم بادئات تاع بعضهم) ──
RING_NEWS = ("[background:linear-gradient(#fff,#fff)_padding-box,"
             "linear-gradient(135deg,#FF6B9D,#e11d48)_border-box] "
             "shadow-[0_0_6px_1px_rgba(255,107,157,0.30)]")
RING_OLDS = [
    ("v3.1 داكنة+فجوة", "border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white"),
    ("كيت31 وردية+فجوة", "border-[#FF6B9D] ring-2 ring-[#FF6B9D] ring-offset-1 ring-offset-white"),
    ("كيت32 وردية ملاصقة", "border-[#FF6B9D] ring-2 ring-[#FF6B9D]"),
    ("داكنة ملاصقة (يدوي)", "border-temu-black ring-2 ring-temu-black"),
]


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


def shape_state(text):
    if SHAPE_NEWS in text:
        return "NEW"
    for name, s in SHAPE_OLDS:
        if s in text:
            return "OLD", name, s
    return "UNKNOWN"


def ring_state(text):
    for name, s in RING_OLDS:  # الأطول أولاً — منع بقايا ring-offset
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

    sh = shape_state(text)
    ri = ring_state(text)
    if sh == "UNKNOWN" or ri == "UNKNOWN":
        return {
            "path": path, "state": "UNKNOWN",
            "why": f"شكل={sh if sh == 'UNKNOWN' else sh[0]} · حلقة={ri if ri == 'UNKNOWN' else ri[0]}"
                   " — سلسلة معروفة مالقيتهاش (ملف مبدّل يدوياً؟)",
            "raw": raw, "text": text,
        }

    if sh == "NEW" and ri == "NEW":
        return {"path": path, "state": "PATCHED", "raw": raw}
    return {"path": path, "state": "PARTIAL", "shape": sh, "ring": ri, "raw": raw}


def write_diag(path, info):
    diag = path + DIAG_SUFFIX
    lines = [
        "كيت 33 [swatch-gradient] — تقرير تشخيصي (ماشي ملف كود — يمسح براحتك)",
        "=" * 70,
        f"الملف: {path}",
        f"السبب: {info.get('why', '?')}",
        "",
        "الهدف:",
        f"  [ثابت] {SHAPE_NEWS}",
        f"  [نشيط] {RING_NEWS}",
        "الحالات المعروفة اللي كيتقبلها السكريبت:",
    ]
    for name, s in SHAPE_OLDS:
        lines.append(f"  · شكل — {name}: {s}")
    for name, s in RING_OLDS:
        lines.append(f"  · حلقة — {name}: {s}")
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
            if any(k in line for k in ("rounded-md", "rounded-full", "ring-", "aria-pressed",
                                        "border-2", "background:linear")):
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
        print("      دايماً فالحالة النهائية (هالة وردية متدرجة). ✅")
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
    if info["shape"][0] == "OLD":
        new_text = new_text.replace(info["shape"][2], SHAPE_NEWS)
        did.append(f"الثابت: {info['shape'][1]} → دائري + حدود 2px شفافة (جاهزة للتدرج)")
    if info["ring"][0] == "OLD":
        new_text = new_text.replace(info["ring"][2], RING_NEWS)
        did.append(f"النشيط: {info['ring'][1]} → هالة وردية متدرجة #FF6B9D→#e11d48 + توهج خفيف")

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
        print("كيت 33 [swatch-gradient] — فحص الحالة (--check · بلا كتابة)")
    else:
        print("كيت 33 [swatch-gradient] — هالة وردية متدرجة #FF6B9D→#e11d48")
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
                sh = info["shape"]
                ri = info["ring"]
                extra = (f" (ثابت={sh[1] if sh[0] == 'OLD' else sh}"
                         f" · نشيط={ri[1] if ri[0] == 'OLD' else ri})")
            if st == "UNKNOWN":
                extra = f" — {info.get('why')}"
            print(f"   {p} → {st}{extra}")
        else:
            rc |= patch_file(p)

    print("─" * 62)
    if mode == "patch" and rc == 0:
        print("✔ المرحلة الجاية:  npm run build  →  deploy")
        print("  التراجع: انسخ .bak-kit33 فوق ProductCard.tsx")
    print("─" * 62)
    return rc


if __name__ == "__main__":
    sys.exit(main())
