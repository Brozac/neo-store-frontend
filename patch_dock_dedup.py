#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kit 29i [dock-dedup] — يحيد الـ Dock المكرّر من app/layout.tsx
════════════════════════════════════════════════════════════════
المشكل: زوج docks متراكبين فأسفل الشاشة:
  • الأصلي  app/components/GlassDock.tsx  — مركوب عبر providers.tsx (يبقى)
  • الجديد  app/components/ui/GlassDock.tsx — مركوب عبر layout.tsx (يتحيد)
هذا الپاتشر كيحيد غير من layout.tsx: سطر import + سطر <GlassDock />.
• fail-closed: أي حالة مشكوك فيها → exit 1 + diag، صفر تخمين
• backup .bak-kit29i (مرة وحدة — الأقدم ما يتمسش)
• idempotent: المرة الثانية = لا شيء يتبدل (exit 0)
• residue guard: أي أثر <GlassDock بعد الحذف → يتعالج ولا fail-closed
"""
import os, re, shutil, sys, time

IMPORT_LINE = "import GlassDock from '@/components/ui/GlassDock';"
MOUNT_RX = re.compile(r"^<GlassDock\s*/>$")
SKIP_DIRS = {"node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "coverage", ".sentinel"}
CANDIDATES = ["app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx", "src/app/layout.jsx"]

def diag(msg):
    try:
        os.makedirs("kit29i-diag", exist_ok=True)
        with open(os.path.join("kit29i-diag", "manifest.txt"), "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S") + " | " + msg + "\n")
    except Exception:
        pass

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def write(p, c):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(c)

print("══ Kit 29i [dock-dedup] — يحيد الـ Dock المكرّر (الأصلي يبقى الوحيد) ══")
print("")

if not (os.path.exists("next.config.ts") or os.path.exists("next.config.js")):
    print("❌ خدم من جذر الفرونت (المجلد اللي فيه next.config.ts)")
    sys.exit(1)

lay = next((c for c in CANDIDATES if os.path.exists(c)), None)
if not lay:
    print("❌ ما لقيتش app/layout.tsx — وين راح ملف الـ layout؟")
    diag("layout not found")
    sys.exit(1)

text = read(lay)
EOL = "\r\n" if "\r\n" in text else "\n"
lines = text.split(EOL)

# ── فحص الحالة ──
idx_import = [i for i, l in enumerate(lines) if l.strip() == IMPORT_LINE]
idx_mount = [i for i, l in enumerate(lines) if MOUNT_RX.match(l.strip())]
imp_lines = [l.strip() for l in lines if l.strip().startswith("import") and "GlassDock" in l and l.strip() != IMPORT_LINE]

# sanity: الملف يبقى ملف layout سليم
if "</body>" not in text:
    print("❌ layout.tsx ما فيهش </body> — الملف مشكوك فيه (fail-closed)")
    diag("no </body> in layout")
    sys.exit(1)

# already-patched?
if not idx_import and not idx_mount:
    print("⏭️ layout.tsx ما فيهش حتى تركيب GlassDock — خلاص تصلح من قبل (idempotent)")
    print("   الـ dock الأصلي كيتسير من providers.tsx — ماكاين ما يتبدل.")
    sys.exit(0)

# fail-closed: import غريب ديال GlassDock (ما هوماش تاعنا)
if imp_lines:
    print("❌ كاين import ديال GlassDock غريب فـ layout.tsx:")
    for l in imp_lines:
        print("   " + l)
    print("   صلحو بيدك أو رجّعو من backup — الپاتشر ما يخمنش (fail-closed)")
    diag("unexpected GlassDock import: " + " | ".join(imp_lines))
    sys.exit(1)
if len(idx_import) > 1 or len(idx_mount) > 1:
    print("❌ أكثر من سطر واحد تاع GlassDock فـ layout.tsx (fail-closed)")
    diag(f"import x{len(idx_import)} mount x{len(idx_mount)}")
    sys.exit(1)

# ── backup (مرة وحدة) ──
bak = lay + ".bak-kit29i"
if not os.path.exists(bak):
    shutil.copy2(lay, bak)
    print("  💾 backup: " + bak)
else:
    print("  💾 backup موجود من قبل — ما تتمسش: " + bak)

# ── الحذف (سطر import + سطر mount + سطر خاوي لي قبل mount إلا كان) ──
kill = set()
if idx_import:
    kill.add(idx_import[0])
if idx_mount:
    m = idx_mount[0]
    kill.add(m)
    if m - 1 >= 0 and lines[m - 1].strip() == "" and m - 1 not in kill:
        kill.add(m - 1)

new_lines = [l for i, l in enumerate(lines) if i not in kill]
new_text = EOL.join(new_lines)

# ── residue: أي <GlassDock /> باقي فنفس السطر مع </body> أو وسط JSX ──
# (الـ mount ديالنا الوحيد الممكن فهاد الملف — الأصلي عمرو ما كيرندر من layout)
RES_RX = re.compile(r"[ \t]*<GlassDock\s*/>")
n_res = len(RES_RX.findall(new_text))
if n_res:
    new_text = RES_RX.sub("", new_text)
    print(f"  ✚ {n_res} mount ملاصق/وسط-سطر تحيد حتا هو")

# ── فحوصات ما قبل الكتابة ──
if IMPORT_LINE in new_text or any(MOUNT_RX.match(l.strip()) for l in new_lines):
    print("❌ بعد التعديل بقا أثر ديال GlassDock — ما كتبت والو (fail-closed)")
    diag("post-check residue")
    sys.exit(1)
if "<GlassDock" in new_text:
    print("❌ بقا شكل غريب ديال <GlassDock> فـ layout.tsx (ماشي self-closing) — fail-closed")
    diag("exotic GlassDock residue")
    sys.exit(1)
if "</body>" not in new_text or "Providers" not in new_text:
    print("❌ التعديل خرّب بنية layout.tsx — ما كتبت والو (fail-closed)")
    diag("structure broken")
    sys.exit(1)

write(lay, new_text)
print("  ✚ تحيد import:  " + IMPORT_LINE)
print("  ✚ تحيد mount:   <GlassDock /> (قبل </body>)")
print("")
print("✅ خلاص — الـ dock الأصلي (providers.tsx) ولا هو الوحيد.")
print("   الشرايح الزجاجية (GlassIcon) فكل الملفات الأخرى كيما هوما.")
print("   دابا: npm run build ثم deploy")
sys.exit(0)
