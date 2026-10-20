#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_products_eta.py — فحص محلي بعد تركيب Kit 29g
  python verify_products_eta.py [FRONTEND_ROOT]
"""
import os, sys

MARKER = "[cj-eta-v5]"
SKIP_DIRS = {"node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "coverage"}
root = sys.argv[1] if len(sys.argv) > 1 else "."

ok = bad = 0
def check(name, cond, extra=""):
    global ok, bad
    if cond: ok += 1; print("  PASS  " + name + (("  — " + extra) if extra else ""))
    else:    bad += 1; print("  FAIL  " + name + (("  — " + extra) if extra else ""))

def find_file(names, roots):
    for r in roots:
        base = os.path.join(root, r) if not os.path.isabs(r) else r
        if not os.path.isdir(base):
            continue
        for nm in names:
            for dirpath, dirnames, filenames in os.walk(base):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                if nm in filenames:
                    return os.path.join(dirpath, nm)
    return None

print("== Kit 29g [cj-freeship] — فحص التركيب ==\n")

p_est = find_file(["DeliveryEstimator.tsx", "DeliveryEstimator.jsx"], ["app", "components", "src"])
check("DeliveryEstimator ملقى", p_est is not None, p_est or "")

if p_est:
    src = open(p_est, encoding="utf-8").read()
    check("v5 [cj-eta-v5]", MARKER in src)
    check("🚚 عنوان Free Delivery البارز", "Free Delivery" in src)
    check("❌ بلا أزرار اختيار (aria-pressed محذوف)", "aria-pressed" not in src)
    check("❌ بلا أسماء أزرار v4 (Fastest/Economy)", "Fastest" not in src and "Economy" not in src)
    check("❌ بلا tooltip قنوات (CJ channel:)", "CJ channel:" not in src)
    check("❌ بلا ثمن قنوات فالكود (SHOW_CHANNEL_PRICES)", "SHOW_CHANNEL_PRICES" not in src)
    check("النافذة الحقيقية من ship.arrivalTime", "ship.arrivalTime" in src)
    check("standalone — usePathname", "usePathname" in src)
    check("discovery — /api/products/", "/api/products/" in src)
    check("البريدج — /api/cj-live/product/", "/api/cj-live/product/" in src)
    check("شارة live CJ window", "live CJ window" in src)
    check("رسالة No shipping fees", "No shipping fees" in src)
    check("التوصيل المجاني فشريط الثقة", "Free Worldwide Shipping" in src)
    check("fallback واقعي (+14/+28)", "getDate() + 14" in src and "getDate() + 28" in src)
    check("مناعة props — [key: string]: unknown", "[key: string]: unknown" in src)
    check("بلا ثمن/سلة داخل المكوّن", "laclarcPrice" not in src and "Add to Cart" not in src)

print("")
if bad == 0:
    print("🎯 " + str(ok) + "/" + str(ok) + " PASS — التركيب سليم.")
    print("↳ الخطوة الجاية: npm run build → deploy → صفحة /products/:id من بلادك")
    sys.exit(0)
else:
    print("🚫 " + str(bad) + " FAIL — شغّل patch_products_eta.py أولاً أو قارن مع .bak-kit29g")
    sys.exit(1)
