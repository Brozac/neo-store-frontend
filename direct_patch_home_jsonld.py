#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
direct_patch_home_jsonld.py — Laclarc Section 3 HOTFIX (الخطوة 2/2)

شنو كيدير فـ app/page.tsx:
  ① كيزيد:  import SiteJsonLd from '@/components/site-jsonld';
     (مور سطر import { useInfiniteFeed } ... )
  ② كيغلف الـ Suspense بـ fragment ويزيد <SiteJsonLd /> قبل منو:
       return (
         <>
           <SiteJsonLd />
           <Suspense fallback={...}>
             <HomeContent />
           </Suspense>
         </>
       );
     علاش قبل الـ Suspense؟ باش يبان فالـ HTML الأولي حتى إلا
     الـ shell تصاوب والباقي ستريمّا — وكيتغطى حتى /?search=...

المتطلبات:
  - site-jsonld.tsx خاصو يكون منقل لـ components/site-jsonld.tsx (شوف README)
  - app/page.tsx خاصو يكون نسخة v5.1 ( anchors متطابقين)

الاستعمال (من جذر الفرونت):
  python direct_patch_home_jsonld.py            # dry-run
  python direct_patch_home_jsonld.py --apply    # كتابة + backup

Exit codes: 0 = نجاح/idempotent · 1 = I/O · 2 = الباترن ما تلقاش
"""
import codecs
import os
import shutil
import sys

TARGET_DEFAULT = os.path.join("app", "page.tsx")
BACKUP_SUFFIX = ".bak-jsonldfix"

IMPORT_ANCHOR = "import { useInfiniteFeed } from '@/lib/useInfiniteFeed';"
IMPORT_LINE = "import SiteJsonLd from '@/components/site-jsonld';"

OPEN_ANCHOR = "  return (\n    <Suspense fallback={"
OPEN_NEW = "  return (\n    <>\n      <SiteJsonLd />\n    <Suspense fallback={"

CLOSE_ANCHOR = "    </Suspense>\n  );\n}"
CLOSE_NEW = "    </Suspense>\n    </>\n  );\n}"


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


def build_patched(text):
    """Return (patched_text, report_lines) or (None, errors)."""
    report = []

    if "SiteJsonLd" in text:
        return text, ["[OK] idempotent — SiteJsonLd موجود من قبل، ما كاين ما يدير"]

    errors = []

    # ① import
    n_imp = text.count(IMPORT_ANCHOR)
    if n_imp != 1:
        errors.append(
            "anchor import ما تلقاش (لقاها %d مرة) — الموقع: سطر import { useInfiniteFeed }"
            % n_imp
        )
    else:
        report.append("[1/3] كيزيد import SiteJsonLd مور الـ useInfiniteFeed import")

    # ② open fragment
    n_open = text.count(OPEN_ANCHOR)
    if n_open != 1:
        errors.append(
            "anchor 'return ( <Suspense fallback={' ما تلقاش (لقاها %d مرة)" % n_open
        )
    else:
        report.append("[2/3] كيزيد <> + <SiteJsonLd /> قبل الـ Suspense")

    # ③ close fragment
    n_close = text.count(CLOSE_ANCHOR)
    if n_close != 1:
        errors.append(
            "anchor '</Suspense> ); }' ما تلقاش (لقاها %d مرة)" % n_close
        )
    else:
        report.append("[3/3] كيسد الـ fragment </> مور الـ Suspense")

    if errors:
        return None, errors

    out = text.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + "\n" + IMPORT_LINE, 1)
    out = out.replace(OPEN_ANCHOR, OPEN_NEW, 1)
    out = out.replace(CLOSE_ANCHOR, CLOSE_NEW, 1)

    # guards
    checks = [
        (out.count("SiteJsonLd") == 2, "SiteJsonLd خاصو يبان جوج مرات (import + JSX)"),
        (out.count("<>") >= 1 and out.count("</>") >= 1, "الـ fragment ماشي متوازن"),
        (out.count("{") == out.count("}"), "الأقواس ماشي متوازنين"),
        (IMPORT_LINE in out, "سطر الاستيراد ما دخلش"),
        (OPEN_NEW in out, "الفتح ما دخلش"),
        (CLOSE_NEW in out, "الإغلاق ما دخلش"),
    ]
    errors = ["GUARD: " + msg for ok, msg in checks if not ok]
    if errors:
        return None, errors
    return out, report


def main():
    args = [a for a in sys.argv[1:]]
    apply = "--apply" in args
    target = TARGET_DEFAULT
    for a in args:
        if a.endswith((".tsx", ".ts")) and not a.startswith("--"):
            target = a

    if not os.path.isfile(target):
        print("[ERROR] ملف ما كاينش: %s — شغّلو من جذر الفرونت" % target)
        return 1

    if not os.path.isfile(os.path.join("components", "site-jsonld.tsx")):
        print("[ERROR] components/site-jsonld.tsx ما كاينش!")
        print("        أول حاجة: نسخ site-jsonld.tsx من الـ ZIP لـ components/")
        return 2

    text, bom, crlf = load_text(target)
    patched, msgs = build_patched(text)

    if patched is None:
        print("[ERROR] الباترن ما تطابقش — ما كتب والو:")
        for m in msgs:
            print("   " + m)
        print("        الحل اليدوي (شوف README_SECTION3_FIX.md قسما 'يدوياً')")
        return 2

    idempotent = any("idempotent" in m for m in msgs)
    print("[PLAN] %s" % target)
    for m in msgs:
        print("   " + m)

    if idempotent:
        return 0
    if not apply:
        print("[DRY-RUN] ما كتب والو — عاود بـ --apply باش تكتب (+backup %s)" % BACKUP_SUFFIX)
        return 0

    backup = target + BACKUP_SUFFIX
    shutil.copyfile(target, backup)
    save_text(target, patched, bom, crlf)
    print("[APPLIED] ✓ backup: %s" % backup)
    print("[NEXT] npm run build (محلي) → commit/push → Deploy → verifier")
    return 0


if __name__ == "__main__":
    sys.exit(main())
