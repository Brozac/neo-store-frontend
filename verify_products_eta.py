#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_products_eta.py — فحص محلي بعد تركيب Kit 29e v2
  python verify_products_eta.py [FRONTEND_ROOT]
  FRONTEND_ROOT الافتراضي: المجلد الحالي
"""
import os, sys

MARKER = "[cj-eta-v3]"
SKIP_DIRS = {"node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "coverage"}
root = sys.argv[1] if len(sys.argv) > 1 else "."

ok = bad = 0
def check(name, cond, extra=""):
    global ok, bad
    if cond: ok += 1; print("  PASS  " + name + (("  — " + extra) if extra else ""))
    else:    bad += 1; print("  FAIL  " + name + (("  — " + extra) if extra else ""))

def info(name, extra=""):
    print("  INFO  " + name + (("  — " + extra) if extra else ""))

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

print("== Kit 29e v2 [cj-eta-v3] — فحص التركيب ==\n")

p_est = find_file(["DeliveryEstimator.tsx", "DeliveryEstimator.jsx"], ["app", "components", "src"])
check("DeliveryEstimator ملقى", p_est is not None, p_est or "حتى ف app/ و components/ و src/")

if p_est:
    src = open(p_est, encoding="utf-8").read()
    check("v3 [cj-eta-v3]", MARKER in src)
    check("standalone — usePathname", "usePathname" in src)
    check("discovery — /api/products/", "/api/products/" in src)
    check("البريدج — /api/cj-live/product/", "/api/cj-live/product/" in src)
    check("fallback واقعي (+14/+28)", "getDate() + 14" in src and "getDate() + 28" in src)
    check("شارة live CJ quote", "live CJ quote" in src)
    check("مناعة props — [key: string]: unknown", "[key: string]: unknown" in src)
    check("بلا ثمن داخل المكوّن (الخيار A)", "laclarcPrice" not in src and "Add to Cart" not in src)

p_pdc = find_file(["ProductDetailsClient.tsx", "ProductDetailsClient.jsx"], ["app", "components", "src"])
if p_pdc:
    s = open(p_pdc, encoding="utf-8").read()
    if "cjPid" in s:
        info("PDC كيمرر cjPid — كيستعمل مباشرة (بلا fetch اكتشاف)")
    else:
        info("PDC ما تلمسش — المكوّن كيكتاشف المنتج بوحدو")
else:
    info("PDC مالقيتوش فالمسارات المعتادة — عادي")

print("")
if bad == 0:
    print("🎯 " + str(ok) + "/" + str(ok) + " PASS — التركيب سليم.")
    print("↳ الخطوة الجاية: npm run build → deploy → حل صفحة /products/:id من بلادك")
    print("  DevTools → Network → فلتر 'cj-live' → طلب واحد لكل منتج (كاش 10د).")
    sys.exit(0)
else:
    print("🚫 " + str(bad) + " FAIL — شغّل patch_products_eta.py أولاً أو قارن مع .bak-kit29e")
    sys.exit(1)
