#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_swatch_round_pink.py — كيت 31 [swatch-round-pink]
════════════════════════════════════════════════════════════════════════════════
الطلب (المالك، لايف): «السواتشات نحوسهم يعود شكل دائري و لحدود يعود لونهم وردي»

التحويل (جوج تعديلات جراحية بالضبط فـ ProductCard.tsx — كيت 30 v3.1):
  1) الشكل:     rounded-md  →  rounded-full          (دائري، نفس لغة صفحة المنتج)
  2) الحلقة:    border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white
             →  border-[#FF6B9D]  ring-2 ring-[#FF6B9D]  ring-offset-1 ring-offset-white
                (#FF6B9D = الوردي الرسمي تاع الموقع — نفس تاع السعر/الشارة)

برهان اللايف (مستخرج من laclarc.com يوم 2026-10-21 من الـ DOM الحقيقي):
  كارت اللائحة (v3.1):
    شكل:  w-5 h-5 rounded-md overflow-hidden border transition-all duration-150 cursor-pointer p-0
    نشيط: border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white
    خامل: border-temu-gray-border-light hover:border-temu-gray-light
  (صفحة المنتج PDP دائرة أصلاً بحد بنفسجي — ما تلمسش هنا)

المنهجية (نفس عائلة 29/30):
  · fail-closed: كيلمس غير ProductCard.tsx (app/components ولا src/app/components)
    + ماركرات الإصدار لازم تكون موجودة (aria-pressed) — أي شك = ما كيدير والو
  · backup: ProductCard.tsx.bak-kit31 (أول نسخة كتبقى، ما كيتعاودش يكتبها)
  · idempotent: رجعة تشغّلو = «NOTHING TO DO» exit 0
  · diag بامتداد .txt دائماً (درس كيت 30: .tsx فالشجرة = قنبلة بناء)
  · pure-stdlib · الخدمة بالبايتات (CRLF/LF كيتحافظ عليهم)
════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CARD = "ProductCard.tsx"
BACKUP_SUFFIX = ".bak-kit31"
DIAG_SUFFIX = ".kit31-diag.txt"

# ── ماركرات الإصدار: الملف لازم يكون كارت كيت 30 (سواتشات) ──
REQUIRED_MARKERS = ("aria-pressed",)

# ── التحويلات: (القديم بالضبط → الجديد بالضبط) ──
# كل سلسلة مأخوذة حرفياً من الـ DOM الحقيقي لايف (2026-10-21)
SHAPE_OLD = "w-5 h-5 rounded-md overflow-hidden border transition-all duration-150 cursor-pointer p-0"
SHAPE_NEW = "w-5 h-5 rounded-full overflow-hidden border transition-all duration-150 cursor-pointer p-0"

RING_OLD = "border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white"
RING_NEW = "border-[#FF6B9D] ring-2 ring-[#FF6B9D] ring-offset-1 ring-offset-white"


def find_targets():
    """كيكشف ProductCard.tsx: من CWD ومن جنب السكريبت (+درجة للفوق)."""
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


def part_state(text, old, new):
    """حالة جزء: OLD=يحتاج ترقيع · NEW=مرقّع · UNKNOWN=انحراف (فشل)."""
    if old in text:
        return "OLD"
    if new in text:
        return "NEW"
    return "UNKNOWN"


def check_file(path):
    """كيقرا الملف ويطلع الحالة الكاملة (بلا كتابة)."""
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
                "why": f"ماركر الإصدار «{m}» ماكانش — هذا ماشي كارت كيت 30 (v3.x)",
                "raw": raw, "text": text,
            }

    sh = part_state(text, SHAPE_OLD, SHAPE_NEW)
    ri = part_state(text, RING_OLD, RING_NEW)

    if sh == "UNKNOWN" or ri == "UNKNOWN":
        return {
            "path": path, "state": "UNKNOWN",
            "why": f"شكل={sh} · حلقة={ri} — سلسلة معروفة مالقيتهاش (ملف مبدّل يدوياً؟)",
            "raw": raw, "text": text,
        }

    if sh == "NEW" and ri == "NEW":
        return {"path": path, "state": "PATCHED", "raw": raw}

    if sh == "OLD" and ri == "OLD":
        return {"path": path, "state": "RAW", "raw": raw}

    return {"path": path, "state": "PARTIAL", "shape": sh, "ring": ri, "raw": raw}


def write_diag(path, info):
    """تشخيص بامتداد .txt (عمداً ماشي .tsx — درس كيت 30)."""
    diag = path + DIAG_SUFFIX
    lines = [
        "كيت 31 [swatch-round-pink] — تقرير تشخيصي (ماشي ملف كود — يمسح براحتك)",
        "=" * 70,
        f"الملف: {path}",
        f"السبب: {info.get('why', '?')}",
        "",
        "السلاسل اللي كينقلب عليها الباتشر:",
        f"  [شكل  قديم] {SHAPE_OLD}",
        f"  [شكل  جديد] {SHAPE_NEW}",
        f"  [حلقة قديم] {RING_OLD}",
        f"  [حلقة جديد] {RING_NEW}",
        "",
        "السطور المرتبطة فملفك الحالي (rounded-md / rounded-full / ring- / aria-pressed):",
        "-" * 70,
    ]
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
        if n == 0:
            lines.append("(حتى سطر ما فيه الكلمات المفتاحية — الملف يمكن ماشي هو)")
    with open(diag, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return diag


def patch_file(path):
    info = check_file(path)
    st = info["state"]

    if st == "PATCHED":
        print(f"   ⏭  {path}")
        print("      دايماً مرقّع (دائري + وردي) — والو باش يدير. ✅")
        return 0

    if st == "UNKNOWN":
        print(f"   ⚠ {path}")
        print(f"      {info['why']}")
        diag = write_diag(path, info)
        print(f"      📄 التشخيص: {diag}  (بامتداد .txt — ماكيضرش البناء)")
        print("      → ابعت/شوف التشخيص قبل أي إعادة محاولة. الملف ما تلمسش.")
        return 1

    # RAW ولا PARTIAL → بناء النص الجديد
    text = info["raw"].decode("utf-8")
    new_text = text
    did = []
    if info.get("shape", "OLD") == "OLD":
        new_text = new_text.replace(SHAPE_OLD, SHAPE_NEW)
        did.append("الشكل: مربع مضبّب → دائري (rounded-full)")
    if info.get("ring", "OLD") == "OLD":
        new_text = new_text.replace(RING_OLD, RING_NEW)
        did.append("الحلقة: داكن #1D1E3C → وردي #FF6B9D (+فجوة بيضاء)")

    if not did:
        print(f"   ⏭  {path} — والو باش يدير")
        return 0

    # backup (أول مرة برك — ما كيتعاودش يكتب فوق تراجع قديم)
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
        print("كيت 31 [swatch-round-pink] — فحص الحالة (--check · بلا كتابة)")
    else:
        print("كيت 31 [swatch-round-pink] — سواتشات دائرية + حلقة وردية #FF6B9D")
    print("─" * 62)

    targets = find_targets()
    if not targets:
        print(f"⚠ ما لقيتش {CARD} فـ app/components ولا src/app/components.")
        print("  حل الزيب فجذر الفرونت (جنب package.json) وعاود.")
        return 1

    rc = 0
    for p in targets:
        if mode == "--check":
            info = check_file(p)
            st = info["state"]
            extra = ""
            if st == "PARTIAL":
                extra = f" (شكل={info.get('shape')} · حلقة={info.get('ring')})"
            if st == "UNKNOWN":
                extra = f" — {info.get('why')}"
            print(f"   {p} → {st}{extra}")
        else:
            rc |= patch_file(p)

    print("─" * 62)
    if mode == "patch" and rc == 0:
        print("✔ المرحلة الجاية:  npm run build  →  deploy")
        print("  التراجع (إلا بغيتيه): انسخ .bak-kit31 فوق ProductCard.tsx")
    print("─" * 62)
    return rc


if __name__ == "__main__":
    sys.exit(main())
