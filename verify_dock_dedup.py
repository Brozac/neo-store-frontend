#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_dock_dedup.py — تحقق Kit 29i [dock-dedup]
كل الفحوصات لازم ينجحو؛ أول فشل = exit 1.
"""
import os, re, sys

ok = fail = 0
def check(name, cond, extra=""):
    global ok, fail
    if cond: ok += 1;  print("  PASS  " + name)
    else:    fail += 1; print("  FAIL  " + name + (("  — " + extra) if extra else ""))

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

print("══ verify Kit 29i [dock-dedup] ══")
CAND = ["app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx", "src/app/layout.jsx"]
lay = next((c for c in CAND if os.path.exists(c)), None)
check("layout.tsx موجود", bool(lay))
if not lay:
    sys.exit(1)
t = read(lay)

check("بلا import ديال ui/GlassDock", "from '@/components/ui/GlassDock'" not in t)
check("بلا <GlassDock /> mount", not re.search(r"(?m)^\s*<GlassDock\s*/>\s*$", t))
check("layout سليم (</body> موجود)", "</body>" in t)
check("layout سليم (Providers موجود)", "Providers" in t)

prov = next((c for c in ["app/providers.tsx", "app/providers.jsx", "src/app/providers.tsx"] if os.path.exists(c)), None)
check("providers.tsx موجود", bool(prov))
if prov:
    p = read(prov)
    check("الـ dock الأصلي مركوب فـ providers", "components/GlassDock" in p and "<GlassDock />" in p)

check("الـ dock الأصلي موجود (components/GlassDock.tsx)", os.path.exists("app/components/GlassDock.tsx"))
if os.path.exists("app/components/GlassDock.tsx"):
    d = read("app/components/GlassDock.tsx")
    check("الأصلي فيه أيقونات Laclarc (المرجع)", "LaclarcIcons" in d)
    check("الأصلي فيه badge السلة", "totalItemsCount" in d or "badge" in d)

check("سيستيم الزجاج باقي (ui/GlassIcon.tsx)", os.path.exists("app/components/ui/GlassIcon.tsx"))

# لا حتى ملف فالشجرة كيستورد ui/GlassDock من بعد التصليح
SKIP_DIRS = {"node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "coverage", ".sentinel"}
left = 0
glass_files = 0
for root, dirnames, filenames in os.walk("app"):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for nm in filenames:
        if not nm.endswith((".tsx", ".jsx", ".ts", ".js")):
            continue
        p = os.path.join(root, nm)
        try:
            c = read(p)
        except Exception:
            continue
        if "ui/GlassDock" in c:
            left += 1
        if "ui/GlassIcon" in c:
            glass_files += 1
check("حتى ملف ما كيستورد ui/GlassDock", left == 0, f"{left} ملف")
check("سيستيم الزجاج منتشر (GlassIcon فـ 20+ ملف)", glass_files >= 20, f"{glass_files} ملف")

print("")
if fail:
    print(f"❌ {fail} فحص فاشل من {ok+fail}")
    sys.exit(1)
print(f"✅ كلش PASS ({ok}/{ok}) — التداخل زال، الـ dock الأصلي وحيد، الزجاج باقي.")
sys.exit(0)
