#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
direct_patch_pdp_seo.py — Laclarc Section 2 Phase B — Task 22
==============================================================
Target : app/products/[id]/page.tsx (Next.js App Router, ISR v2.2)
Goal   : generateMetadata reads DB-injected seo_title / seo_meta_description
         (they arrive automatically via the existing `SELECT *` in
         GET /api/products/:id — zero backend changes) with FULL fallback
         to the current behavior → safe to deploy BEFORE the injection.

EDITS (3, independent, idempotent)
  P1  meta title      : title: { absolute: product.seo_title || `${product.title} | Laclarc` }
  P2  meta/OG/TW desc : description: product.seo_meta_description || cleanDescription   (×3)
  P3  OG title        : title: product.seo_title || `${product.title} | Laclarc`

SAFETY (same armor as Task 21-g direct patcher)
  · idempotent — SKIP edits already present, run it 100 times, same result
  · exact-count asserts (P1=1, P2=3, P3=1) — unexpected file state → refuse
  · CRLF/LF + BOM preserved · .bak backup · brace-delta invariant
  · --dry-run · --file · --fullfile escape hatch
  · post-verify: 3 markers + counts
"""

import argparse
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

P1_OLD = "title: { absolute: `${product.title} | Laclarc` },"
P1_NEW = "title: { absolute: product.seo_title || `${product.title} | Laclarc` },"
P2_OLD = "description: cleanDescription,"
P2_NEW = "description: product.seo_meta_description || cleanDescription,"
P3_OLD = "title: `${product.title} | Laclarc`,"
P3_NEW = "title: product.seo_title || `${product.title} | Laclarc`,"

P1_MARK = "title: { absolute: product.seo_title ||"
P2_MARK = "description: product.seo_meta_description || cleanDescription"
P3_MARK = "title: product.seo_title || `${product.title}"

# sanity anchors — the file we know
ANCHORS = ("generateMetadata", "ProductDetailsClient", "cleanDescription")


def find_target(explicit):
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            fail(f"--file not found: {p.resolve()}", 2)
        return p.resolve()
    for c in (
        "app/products/[id]/page.tsx",
        "frontend/app/products/[id]/page.tsx",
        "src/app/products/[id]/page.tsx",
    ):
        if Path(c).is_file():
            return Path(c).resolve()
    fail(
        "products/[id]/page.tsx not found.\n"
        "  Run from the FRONTEND repo root, or pass --file \"app/products/[id]/page.tsx\"",
        2,
    )


def fail(msg, code):
    print(f"\n[FAIL] {msg}")
    sys.exit(code)


def read_text(path):
    raw = path.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    crlf = text.count("\r\n")
    lf = text.count("\n") - crlf
    eol = "\r\n" if crlf > lf else "\n"
    return text.replace("\r\n", "\n"), eol, bom


def write_text(path, text, eol, bom):
    data = text.replace("\n", eol).encode("utf-8")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def backup(path):
    base = path.with_name(path.name + ".bak-pdpseo")
    b, n = Path(str(base)), 2
    while b.exists():
        b, n = Path(f"{base}-{n}"), n + 1
    shutil.copy2(path, b)
    return b


def brace_delta(s):
    return s.count("{") - s.count("}")


def apply_edits(src):
    plan, out = [], src

    # P1 — meta title
    if P1_MARK in out:
        plan.append(("P1 meta title", "SKIP", "already reads seo_title"))
    else:
        c = out.count(P1_OLD)
        if c != 1:
            plan.append(("P1 meta title", "FAIL", f"expected 1 occurrence, found {c} — use --fullfile"))
        else:
            out = out.replace(P1_OLD, P1_NEW, 1)
            plan.append(("P1 meta title", "APPLY", "absolute title prefers seo_title"))

    # P2 — descriptions ×3 (return + openGraph + twitter)
    if P2_MARK in out:
        plan.append(("P2 descriptions", "SKIP", "already reads seo_meta_description"))
    else:
        c = out.count(P2_OLD)
        if c != 3:
            plan.append(("P2 descriptions", "FAIL", f"expected 3 occurrences (meta+OG+TW), found {c} — use --fullfile"))
        else:
            out = out.replace(P2_OLD, P2_NEW)
            plan.append(("P2 descriptions", "APPLY", "3× now prefer seo_meta_description"))

    # P3 — OG title
    if P3_MARK in out:
        plan.append(("P3 OG title", "SKIP", "already reads seo_title"))
    else:
        c = out.count(P3_OLD)
        if c != 1:
            plan.append(("P3 OG title", "FAIL", f"expected 1 occurrence, found {c} — use --fullfile"))
        else:
            out = out.replace(P3_OLD, P3_NEW, 1)
            plan.append(("P3 OG title", "APPLY", "OG prefers seo_title"))

    return out, plan


def verify(src):
    return [
        ("P1", src.count(P1_MARK) == 1),
        ("P2", src.count(P2_MARK) == 3),
        ("P3", src.count(P3_MARK) == 1),
    ]


def main():
    ap = argparse.ArgumentParser(description="Laclarc Section 2 — PDP generateMetadata direct patcher")
    ap.add_argument("--file", help="path to products/[id]/page.tsx (default: auto-find)")
    ap.add_argument("--fullfile", help="overwrite target with known-good full copy")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print("=" * 64)
    print("Laclarc direct_patch_pdp_seo.py — Section 2 Phase B (Task 22)")
    print("=" * 64)

    target = find_target(args.file)
    src, eol, bom = read_text(target)
    print(f"[OK]   target : {target}")
    print(f"[OK]   state  : {len(src.splitlines())} lines | EOL={'CRLF' if eol == chr(13)+chr(10) else 'LF'} | BOM={bom}")
    before = brace_delta(src)

    if args.fullfile:
        ff = Path(args.fullfile)
        if not ff.is_file():
            fail(f"--fullfile not found: {ff.resolve()}", 2)
        new_text, _, _ = read_text(ff)
        bad = [k for k, ok in verify(new_text) if not ok]
        if bad:
            fail(f"--fullfile is not the known-good version (missing {', '.join(bad)})", 2)
        if args.dry_run:
            print("[DRY]  would overwrite target — abort (dry-run)")
            sys.exit(0)
        bk = backup(target)
        write_text(target, new_text, eol, bom)
        print(f"[OK]   backup : {bk.name}")
        print("[OK]   known-good copy applied")
        print("\nDONE. Next: git add -A && git commit && git push")
        sys.exit(0)

    missing = [a for a in ANCHORS if a not in src]
    if missing:
        fail(f"file does not look like products/[id]/page.tsx (missing: {', '.join(missing)}) — use --fullfile", 2)

    new_src, plan = apply_edits(src)

    print("\n--- Plan " + "-" * 40)
    changed = False
    for name, status, detail in plan:
        mark = {"APPLY": "[DO ]", "SKIP": "[SKIP]", "FAIL": "[!!]"}[status]
        print(f"{mark} {name:<16} {detail}")
        if status == "APPLY":
            changed = True
        if status == "FAIL":
            print("\n[FAIL] unexpected file state — NOTHING written.")
            print(f"       rescue: python {Path(sys.argv[0]).name} --fullfile products-id-page.full.tsx")
            sys.exit(2)

    if not changed:
        print("\n[OK]   ALL EDITS ALREADY PRESENT — nothing to do.")
        sys.exit(0)

    if args.dry_run:
        print("\n[DRY]  dry-run: nothing written. Re-run without --dry-run to apply.")
        sys.exit(0)

    if brace_delta(new_src) != before:
        fail("brace-balance invariant violated — refusing to write (file untouched)", 1)

    bk = backup(target)
    write_text(target, new_src, eol, bom)
    print(f"\n[OK]   backup : {bk.name}")
    print(f"[OK]   written: {target}")

    v_src, _, _ = read_text(target)
    bad = [k for k, ok in verify(v_src) if not ok]
    if bad:
        fail(f"post-verify FAILED ({', '.join(bad)}) — restore from {bk.name}", 1)
    print("[OK]   verify : P1=1 P2=3 P3=1 | brace-delta stable | EOL preserved")

    print("\n" + "=" * 64)
    print("DONE. generateMetadata now prefers DB seo_title/seo_meta_description.")
    print("Fallback-safe: products without injection behave exactly as before.")
    print("Next (PowerShell, frontend root):")
    print("  git add -A")
    print('  git commit -m "SEO S2: PDP metadata reads DB seo_* (fallback-safe)"')
    print("  git push")
    print("=" * 64)


if __name__ == "__main__":
    main()
