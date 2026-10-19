#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_jsonld_fix.py — Laclarc Section 3 HOTFIX verifier (SSR-level)

شنو كيفحص:
  [HOME]  https://laclarc.com/
    [1] HTTP 200
    [2] بلوكات ld+json = 1 بالضبط (التكرار فالمصدر = FAIL)
    [3] الأنواع: OnlineStore + WebSite + SearchAction
    [4] urlTemplate = https://laclarc.com/?search={search_term_string}
  [PRODUCT] https://laclarc.com/products/36545 (أي منتج)
    [5] HTTP 200
    [6] تسريب الـ store graph: بلوكات فيها OnlineStore/WebSite = 0
        (Product/BreadcrumbList مسموحين — هادو ديال الصفحة)

⚠️ الحدود: هادا فاحص SSR (view-source). التكرار لي كان Google شافو
   كيجي من الـ RSC payload — ما كيتشافش فهاد المستوى. الحكم النهائي
   ديما = Rich Results Test من بعد الـ deploy.

الاستعمال:
  python verify_jsonld_fix.py                       # حي على laclarc.com
  python verify_jsonld_fix.py --home <url> --product <url>
  python verify_jsonld_fix.py --file <local.html>   # فحص ملف محلي (HOME checks)

Exit: 0 = PASS · 1 = FAIL
"""
import json
import re
import sys
import urllib.request

SITE = "https://laclarc.com"
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en",
}
SCRIPT_RE = re.compile(
    r"<script[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.S | re.I,
)


def get_source(src):
    if src.startswith("http://") or src.startswith("https://"):
        req = urllib.request.Request(src, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace"), r.status
    with open(src, "rb") as f:
        return f.read().decode("utf-8", "replace"), None


def parse_blocks(html):
    out = []
    for m in SCRIPT_RE.finditer(html):
        raw = m.group(1).strip()
        try:
            out.append(json.loads(raw))
        except Exception as e:
            out.append({"_parse_error": str(e)})
    return out


def collect_types(node, acc):
    if isinstance(node, dict):
        t = node.get("@type")
        if isinstance(t, str):
            acc.add(t)
        elif isinstance(t, list):
            acc.update(x for x in t if isinstance(x, str))
        for v in node.values():
            collect_types(v, acc)
    elif isinstance(node, list):
        for v in node:
            collect_types(v, acc)
    return acc


def find_url_template(node):
    """كل قيم urlTemplate فالبلوك."""
    found = []

    def walk(n):
        if isinstance(n, dict):
            for k, v in n.items():
                if k == "urlTemplate" and isinstance(v, str):
                    found.append(v)
                else:
                    walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)

    walk(node)
    return found


def check_home(src, ok_flags):
    print("─" * 60)
    print("[HOME] %s" % src)
    try:
        html, status = get_source(src)
    except Exception as e:
        print("   [FAIL] fetch: %s" % e)
        return False
    ok = True
    if status is not None:
        p1 = status == 200
        ok &= p1
        print("   [%s] [1] HTTP %s | bytes=%d" % ("OK" if p1 else "FAIL", status, len(html)))
    else:
        print("   [OK] [1] ملف محلي | bytes=%d" % len(html))

    blocks = parse_blocks(html)
    p2 = len(blocks) == 1
    ok &= p2
    print("   [%s] [2] بلوكات ld+json = %d (متوقع 1)" % ("OK" if p2 else "FAIL", len(blocks)))
    if len(blocks) > 1:
        canon = {json.dumps(b, sort_keys=True, ensure_ascii=False) for b in blocks}
        if len(canon) == 1:
            print("        → كاملين متطابقين: نفس الكائن متكرر (duplicate)")
        types_per = [sorted(collect_types(b, set())) for b in blocks]
        print("        → الأنواع لكل بلوك: %s" % types_per)

    types = set()
    for b in blocks:
        collect_types(b, types)
    for want in ("OnlineStore", "WebSite", "SearchAction"):
        p = want in types
        ok &= p
        print("   [%s] [3] %s" % ("OK" if p else "FAIL", want))

    tpl_ok = False
    if blocks and "_parse_error" not in blocks[0]:
        tpls = find_url_template(blocks[0])
        want_tpl = SITE + "/?search={search_term_string}"
        tpl_ok = want_tpl in tpls
        if tpls:
            print("   [%s] [4] urlTemplate = %s" % ("OK" if tpl_ok else "FAIL", " | ".join(tpls)))
        else:
            print("   [FAIL] [4] urlTemplate ما كاينش")
    else:
        print("   [FAIL] [4] ما قدرتش نقرا الـ JSON")
    ok &= tpl_ok
    ok_flags["home"] = ok
    return ok


def check_product(src, ok_flags):
    print("─" * 60)
    print("[PRODUCT] %s" % src)
    try:
        html, status = get_source(src)
    except Exception as e:
        print("   [FAIL] fetch: %s" % e)
        ok_flags["product"] = False
        return False
    ok = True
    if status is not None:
        p = status == 200
        ok &= p
        print("   [%s] [5] HTTP %s" % ("OK" if p else "FAIL", status))

    blocks = parse_blocks(html)
    leak_blocks = 0
    for b in blocks:
        t = collect_types(b, set())
        if "OnlineStore" in t or "WebSite" in t:
            leak_blocks += 1
    p6 = leak_blocks == 0
    ok &= p6
    print(
        "   [%s] [6] تسريب store graph = %d (متوقع 0 — Product/Breadcrumb مسموحين)"
        % ("OK" if p6 else "FAIL", leak_blocks)
    )
    types = set()
    for b in blocks:
        collect_types(b, types)
    info = sorted(types) if types else []
    print("        الأنواع الموجودة: %s" % (info or "لا والو"))
    ok_flags["product"] = ok
    return ok


def main():
    args = sys.argv[1:]
    home = SITE + "/"
    product = SITE + "/products/36545"
    file_mode = None
    i = 0
    while i < len(args):
        if args[i] == "--home" and i + 1 < len(args):
            home = args[i + 1]
            i += 2
        elif args[i] == "--product" and i + 1 < len(args):
            product = args[i + 1]
            i += 2
        elif args[i] == "--file" and i + 1 < len(args):
            file_mode = args[i + 1]
            i += 2
        else:
            i += 1

    print("🔍 LACLARC SECTION 3 HOTFIX — JSON-LD VERIFIER")
    ok_flags = {}
    if file_mode:
        check_home(file_mode, ok_flags)
    else:
        check_home(home, ok_flags)
        check_product(product, ok_flags)

    print("═" * 60)
    verdict = "✅ PASS" if ok_flags and all(ok_flags.values()) else "❌ FAIL"
    print("RESULT: %s" % verdict)
    if verdict.endswith("FAIL") and not file_mode:
        print("→ ما تنساش: من بعد أي إصلاح خاص الـ deploy يعبر قبل الفحص الحي")
    return 0 if verdict.endswith("PASS") else 1


if __name__ == "__main__":
    sys.exit(main())
