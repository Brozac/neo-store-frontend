#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_variant_truth.py — Kit 29j فاحص ما بعد التركيب (يخدم حتى قبل التركيب — exit 1 = ما مركبش)
"""
import os, sys

REL_CANDS = [
    "app/products/[id]/ProductDetailsClient.tsx",
    "src/app/products/[id]/ProductDetailsClient.tsx",
]

MUST = [
    ("[variant-truth]", "ماركر الكيت"),
    ("const variantEngine", "المحرك"),
    ("const selectedGroup", "المجموعة المختارة"),
    ("const availableSizes", "المقاسات الحقيقية"),
    ("const effectiveSize", "المقاس الفعلي"),
    ("IMG.thumb(g.image)", "سواتش صور الألوان"),
    ("variantEngine.groups.length > 1", "بوابة السواتشات"),
    ("variantEngine.groups.length <= 1", "fallback الدوائر القديمة"),
    ("matchedVariant?.vid", "vid فالسلة"),
]

FORBIDDEN = [
    ("name.includes(selectedColor", "الماتشر المكسور القديم"),
    ("const [selectedColor,", "الحالة القديمة hex"),
    ("${selectedSize.replace(", "esc inline القديم"),
    ("const activePrice", "عرض كلفة CJ للزبون (تسريب هامش — ممنوع)"),
]

def main():
    path = next((c for c in REL_CANDS if os.path.isfile(c)), None)
    if not path:
        print("❌ ما لقيتش ProductDetailsClient.tsx")
        return 1
    text = open(path, encoding="utf-8").read()

    if "[variant-truth]" not in text:
        print("❌ [variant-truth] ما مركبش — شغّل python patch_variant_truth.py الأول")
        return 1

    fails = 0
    for s, why in MUST:
        if s in text:
            print(f"  ✓ {why}")
        else:
            print(f"  ✗ {why} — ناقص ({s})")
            fails += 1
    for s, why in FORBIDDEN:
        if s in text:
            print(f"  ✗ بقايا قديمة: {why} ({s})")
            fails += 1

    bak = path + ".bak-kit29j"
    print(f"  ℹ backup: {'موجود ' + bak if os.path.exists(bak) else 'ما موجود (idempotent re-run؟)'}")

    if fails:
        print(f"❌ verify: {fails} مشكل")
        return 1
    print("✅ verify: [variant-truth] كامل سليم")
    return 0

if __name__ == "__main__":
    sys.exit(main())
