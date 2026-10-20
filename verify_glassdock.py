#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_glassdock.py — فحص محلي بعد تركيب Kit 29h
  python verify_glassdock.py [FRONTEND_ROOT]
"""
import os, sys

SKIP_DIRS = {"node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "coverage"}
root = sys.argv[1] if len(sys.argv) > 1 else "."

ok = bad = 0
def check(name, cond, extra=""):
    global ok, bad
    if cond: ok += 1; print("  PASS  " + name + (("  — " + extra) if extra else ""))
    else:    bad += 1; print("  FAIL  " + name + (("  — " + extra) if extra else ""))

def rd(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

print("== Kit 29h [glassdock-v1] — فحص التركيب ==\n")

gi = os.path.join(root, "app", "components", "ui", "GlassIcon.tsx")
gd = os.path.join(root, "app", "components", "ui", "GlassDock.tsx")
check("GlassIcon.tsx جديد", os.path.exists(gi))
check("GlassDock.tsx جديد", os.path.exists(gd))
if os.path.exists(gi):
    s = rd(gi)
    check("GlassIcon ماركر", "[glassdock-v1]" in s)
    check("خريطة الإيموجي موجودة", "EMOJI_MAP" in s and "GlassInline" in s)
if os.path.exists(gd):
    s = rd(gd)
    check("GlassDock ماركر + active state", "[glassdock-v1]" in s and "aria-current" in s)

lay = os.path.join(root, "app", "layout.tsx")
if os.path.exists(lay):
    s = rd(lay)
    check("GlassDock مركب فالـ layout", "GlassDock" in s and "</body>" in s)

est = None
for base in ("app", "components", "src"):
    bp = os.path.join(root, base)
    if os.path.isdir(bp):
        for dp, dn, fn in os.walk(bp):
            dn[:] = [d for d in dn if d not in SKIP_DIRS]
            if "DeliveryEstimator.tsx" in fn:
                est = os.path.join(dp, "DeliveryEstimator.tsx")
if est:
    s = rd(est)
    check("Estimator v6 زجاجية", "[cj-eta-v6]" in s and "lucide-react" in s)

# عينات من الملفات المعدلة + منع تلوث options
import glob
sample_checks = [
    ("app/orders/page.tsx", "GlassInline"),
    ("app/components/ShipTruthJourney.tsx", "STAGE_ICONS"),
    ("app/components/ShoppableReels.tsx", "volumeX"),
    ("app/components/MultiStepRegister.tsx", "eyeOff"),
]
for relp, needle in sample_checks:
    p = os.path.join(root, relp)
    if os.path.exists(p):
        check(relp + " معدل", needle in rd(p))
    else:
        check(relp + " (ما لقيتوش — سكيب)", True)

contaminated = 0
for p in glob.glob(os.path.join(root, "app", "**", "*.tsx"), recursive=True):
    try:
        s = open(p, encoding="utf-8").read()
    except Exception:
        continue
    if "<option" in s and "<GlassIcon" in s:
        for line in s.split("\n"):
            if "<option" in line and "<GlassIcon" in line:
                contaminated += 1
check("بلا GlassIcon داخل <option>", contaminated == 0, str(contaminated) + " حالة")

print("")
if bad == 0:
    print("🎯 " + str(ok) + "/" + str(ok) + " PASS — التركيب سليم.")
    print("↳ الخطوة الجاية: npm run build → deploy")
    sys.exit(0)
else:
    print("🚫 " + str(bad) + " FAIL — شغّل patch_glassdock.py أو قارن مع .bak-kit29h")
    sys.exit(1)
