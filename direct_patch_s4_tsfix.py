#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
direct_patch_s4_tsfix.py — Laclarc Section 4 hotfix: TS2345 فـ lib/categoriesHub.ts

المشكل (بناء next build فاشل — مُثبت بـ tsc):
  lib/categoriesHub.ts(79,28): error TS2345:
    Argument of type 'RawNode[] | undefined' is not assignable to
    parameter of type 'RawNode[]'.
  السبب: buildNodes كتستقبل n.children (اللي هو RawNode[] | undefined حسب
  RawNode.children?) ولكن التوقيع كان كيطلب RawNode[] بالضبط.
  الجسم كان محمي من قبل (`for (const n of raw || [])`) — إذن الإصلاح
  سيمانتيكياً آمن 100%: غير التوقيع كيتوسع، صفر تغيير فالسلوك.

الإصلاح (سطر واحد):
  function buildNodes(raw: RawNode[], prefix = ''): HubNode[] {
  → function buildNodes(raw: RawNode[] | undefined, prefix = ''): HubNode[] {

الدليل (mirror repo + typescript 5 · strict):
  قبل: tsc --noEmit → 1 خطأ (TS2345 @ 79,28) — نفس خطأ next build ديال المستخدم
  بعد: tsc --noEmit → 0 أخطاء فالمشروع كامل

الاستعمال (من جذر الفرونت، فين كاين lib/categoriesHub.ts):
  python direct_patch_s4_tsfix.py             ← dry-run (PLAN بلا كتابة)
  python direct_patch_s4_tsfix.py --apply     ← تطبيق حقيقي + backup
  python direct_patch_s4_tsfix.py --path DIR  ← مسار بديل (default: المجلد الحالي)

الضمانات:
  • idempotent — التطبيق الثاني = SKIP بلا كتابة
  • backup تلقائي lib/categoriesHub.ts.bak-s4tsfix (غير فأول تطبيق)
  • all-or-nothing — أي خطأ = صفر كتابة + exit 2
  • CRLF/LF + BOM محفوظين كما هم (التعويض داخل السطر برك)
  • توازن الأقواس كيتحقق قبل الكتابة + طول الإضافة = 12 حرف بالضبط

Exit codes: 0 نجاح/idempotent · 1 I/O · 2 guard
"""

import sys
import os
import shutil

REL_PATH = os.path.join("lib", "categoriesHub.ts")
ORIG_SIG = "function buildNodes(raw: RawNode[], prefix = ''): HubNode[] {"
FIXED_SIG = "function buildNodes(raw: RawNode[] | undefined, prefix = ''): HubNode[] {"
RECURSIVE_CALL = "children: buildNodes(n.children, slugPath),"
ADDITION_LEN = len(" | undefined")  # 12
BACKUP_SUFFIX = ".bak-s4tsfix"


def fail(msg, code=2):
    print(f"[ERROR] {msg}")
    print("[ABORTED] — ما تبدل حتى حرف. الملف الأصلي سليم.")
    return code


def load_text(path):
    raw = open(path, "rb").read()
    had_bom = raw.startswith(b"\xef\xbb\xbf")
    if had_bom:
        raw = raw[3:]
    text = raw.decode("utf-8")
    return text, had_bom


def brace_delta(js):
    """توازن الأقواس خارج النصوص والتعليقات (نفس أداة s4_hub)."""
    depth = 0
    i, n = 0, len(js)
    in_s = None  # ' " `
    while i < n:
        ch = js[i]
        if in_s:
            if ch == "\\":
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch in "'\"`":
            in_s = ch
            i += 1
            continue
        if ch == "/" and i + 1 < n and js[i + 1] == "/":
            j = js.find("\n", i)
            i = n if j == -1 else j + 1
            continue
        if ch == "/" and i + 1 < n and js[i + 1] == "*":
            j = js.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                return -1
        i += 1
    return depth


def main():
    args = sys.argv[1:]
    apply = "--apply" in args
    base = "."
    if "--path" in args:
        i = args.index("--path")
        if i + 1 >= len(args):
            print("[ERROR] --path خاصو قيمة")
            return 2
        base = args[i + 1]

    src = os.path.join(base, REL_PATH)
    print(f"[TARGET] {os.path.abspath(src)}")
    if not os.path.isfile(src):
        return fail(
            f"{REL_PATH} ما كاينش فـ {os.path.abspath(base)} — "
            "خدم من جذر الفرونت (فين كاين lib/) ولا استعمل --path",
            1,
        )

    try:
        text, had_bom = load_text(src)
    except OSError as e:
        return fail(f"قراءة فاشلة: {e}", 1)

    # ── idempotence ───────────────────────────────────────────────────
    if FIXED_SIG in text:
        if ORIG_SIG in text:
            return fail("حالة غريبة: التوقيع المصلح والقديم بجوج موجودين — "
                        "صيفط السطور 60-85 ديال الملف قبل أي حاجة.")
        print("[SKIP] الباتش مطبق من قبل (التوقيع فيه | undefined) — والو ما يتبدل.")
        print(f"[OK] buildNodes كتقبل undefined — TS2345 محسول من {REL_PATH}")
        return 0

    # ── guards ────────────────────────────────────────────────────────
    count = text.count(ORIG_SIG)
    if count == 0:
        return fail(
            "التوقيع الأصلي ما تلقاش — الملف تبدل من النسخة المعروفة. "
            "صيفط السطور 60-85 ديال " + REL_PATH + " قبل أي تطبيق."
        )
    if count > 1:
        return fail(f"التوقيع تلقا {count} مرات — خاصو يكون مرة وحدة بالضبط.")

    if RECURSIVE_CALL not in text:
        return fail(
            "الاستدعاء التراجعي (children: buildNodes(n.children...)) ما تلقاش — "
            "بنية الملف ماشي معروفة. صيفط السطور 60-85 قبل أي تطبيق."
        )

    d_orig = brace_delta(text)

    new_text = text.replace(ORIG_SIG, FIXED_SIG, 1)

    # ── validation قبل الكتابة ────────────────────────────────────────
    if new_text.count(FIXED_SIG) != 1:
        return fail("التحقق فاشل: التوقيع المصلح ما بانش مرة وحدة بعد التعويض.")
    delta_len = len(new_text) - len(text)
    if delta_len != ADDITION_LEN:
        return fail(f"طول الإضافة غير متوقع ({delta_len} بدل {ADDITION_LEN}) — باغ مشكل داخلي.")
    d2 = brace_delta(new_text)
    if d2 != d_orig:
        return fail(f"توازن الأقواس ديال الملف تبدل (قبل={d_orig} بعد={d2}).")

    eol = "CRLF" if "\r\n" in text else "LF"
    print("[PLAN] سطر 66: raw: RawNode[]  →  raw: RawNode[] | undefined")
    print(f"[PLAN] EOL={eol} · BOM={'نعم' if had_bom else 'لا'} · +{delta_len} حرف · سطر واحد برك")
    print(f"[PLAN] backup: {REL_PATH}{BACKUP_SUFFIX} (غير فأول تطبيق)")
    print("[PLAN] السلوك فالـ runtime ما كيتبدلش — الجسم كان محمي بـ raw || [] من قبل")

    if not apply:
        print("[DRY-RUN] والو ما تكتب — شغّل بـ --apply باش يطبق.")
        return 0

    backup = src + BACKUP_SUFFIX
    if not os.path.exists(backup):
        shutil.copy2(src, backup)
        print(f"[BACKUP] {backup}")
    else:
        print(f"[BACKUP] كاين من قبل — ما تبدلش: {backup}")

    try:
        data = new_text.encode("utf-8")
        if had_bom:
            data = b"\xef\xbb\xbf" + data
        with open(src, "wb") as f:
            f.write(data)
    except OSError as e:
        return fail(f"كتابة فاشلة: {e} — backup كاين فـ {backup}", 1)

    print("[APPLIED] ✓ التوقيع توسع بـ | undefined — TS2345 محسول")
    print("[VERIFY] npm run build   (ولا أسرع: npx tsc --noEmit)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
