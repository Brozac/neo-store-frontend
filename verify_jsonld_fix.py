#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_jsonld_fix.py v2 — Laclarc Section 3 verifier (SSR-level + payload-aware)

شنو كيفحص:
  [HOME]  https://laclarc.com/  (ولا --file محلي)
    [1] HTTP 200
    [2] عناصر ld+json فالـ DOM = 1 — التكرار الحقيقي = FAIL
        ⚠ v2: النسخ المسلسلة داخل strings ديال الـ RSC payload
          (self.__next_f.push) ما كيتحسبوش عناصر — Google ما كيشوفهمش
          كـ <script> فالـ DOM. كيتّذكرو بـ note، ماشي FAIL.
    [3] الأنواع: OnlineStore + WebSite + SearchAction
    [4] urlTemplate = https://laclarc.com/?search={search_term_string}
  [PRODUCT] https://laclarc.com/products/36545 (أي منتج)
    [5] HTTP 200
    [6] تسريب الـ store graph: عناصر فيها OnlineStore/WebSite = 0
        (Product/BreadcrumbList مسموحين — هادو ديال الصفحة)

جديد v2:
  --dump   يطبع لكل match: offset · واش داخل payload/template · السياق
           اللي قبل · بداية ونهاية المحتوى — للتشخيص ملي [2] كيعطي عدد غريب

الاستعمال:
  python verify_jsonld_fix.py                       # حي على laclarc.com
  python verify_jsonld_fix.py --home <url> --product <url>
  python verify_jsonld_fix.py --file <local.html>
  python verify_jsonld_fix.py --file <local.html> --dump

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
OPEN_SCRIPT_RE = re.compile(r"<script\b", re.I)
CLOSE_SCRIPT_RE = re.compile(r"</script\s*>", re.I)
TEMPLATE_SPAN_RE = re.compile(r"<template\b", re.I)


def get_source(src):
    if src.startswith("http://") or src.startswith("https://"):
        req = urllib.request.Request(src, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace"), r.status
    with open(src, "rb") as f:
        return f.read().decode("utf-8", "replace"), None


# ─── v2: تحليل match-by-match ───────────────────────────────────────────
def _spans_of(html, open_re, close_pat):
    out = []
    for m in open_re.finditer(html):
        gt = html.find(">", m.start())
        if gt < 0:
            continue
        cm = close_pat.search(html, gt)
        if cm:
            out.append((m.start(), cm.end()))
    return out


def analyze_matches(html):
    """لكل match ديال SCRIPT_RE: فين كاين؟ (top-level DOM / جوّا payload /
    جوّا template) + السياق اللي قبل."""
    script_spans = _spans_of(html, OPEN_SCRIPT_RE, CLOSE_SCRIPT_RE)
    template_spans = _spans_of(html, TEMPLATE_SPAN_RE, re.compile(r"</template\s*>", re.I))
    out = []
    for m in SCRIPT_RE.finditer(html):
        in_payload = any(s < m.start() < e for s, e in script_spans)
        in_template = any(s < m.start() < e for s, e in template_spans)
        out.append(
            {
                "start": m.start(),
                "end": m.end(),
                "content": m.group(1).strip(),
                "in_payload": in_payload,
                "in_template": in_template,
                "ctx_before": html[max(0, m.start() - 140):m.start()],
            }
        )
    return out


def parse_blocks(matches):
    out = []
    for x in matches:
        try:
            out.append(json.loads(x["content"]))
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


def dump_matches(matches):
    print("   " + "─" * 54)
    for i, x in enumerate(matches, start=1):
        where = []
        if x["in_payload"]:
            where.append("داخل RSC payload (string — ماشي عنصر DOM)")
        if x["in_template"]:
            where.append("داخل <template>")
        if not where:
            where.append("TOP-LEVEL DOM (عنصر حقيقي)")
        print("   match #%d @ offset %d · %d حرف" % (i, x["start"], x["end"] - x["start"]))
        print("      المكان: %s" % " · ".join(where))
        print("      قبل: %r" % x["ctx_before"][-110:])
        head = x["content"][:150]
        tail = x["content"][-80:] if len(x["content"]) > 150 else ""
        print("      محتوى[بداية]: %r" % head)
        if tail:
            print("      محتوى[نهاية]: %r" % tail)
    print("   " + "─" * 54)


def check_home(src, ok_flags, dump=False):
    print("─" * 60)
    print("[HOME] %s" % src)
    try:
        html, status = get_source(src)
    except Exception as e:
        print("   [FAIL] fetch: %s" % e)
        ok_flags["home"] = False
        return False
    ok = True
    if status is not None:
        p1 = status == 200
        ok &= p1
        print("   [%s] [1] HTTP %s | bytes=%d" % ("OK" if p1 else "FAIL", status, len(html)))
    else:
        print("   [OK] [1] ملف محلي | bytes=%d" % len(html))

    # ─── [2] v2: كنعدو غير عناصر DOM ───
    matches = analyze_matches(html)
    dom_matches = [x for x in matches if not x["in_payload"] and not x["in_template"]]
    payload_n = len(matches) - len(dom_matches)

    if len(matches) == 0:
        p2 = False
        ok = False
        print("   [FAIL] [2] حتى بلوك ld+json ما تلقى!")
    elif len(dom_matches) == 1:
        p2 = True
        if payload_n:
            print(
                "   [OK] [2] عناصر ld+json فالـ DOM = 1 ✓ (raw matches=%d — منهم %d داخل strings ديال الـ payload، Google ما كيشوفهمش كعناصر)"
                % (len(matches), payload_n)
            )
        else:
            print("   [OK] [2] عناصر ld+json فالـ DOM = 1 (متوقع 1)")
    else:
        p2 = False
        ok = False
        print(
            "   [FAIL] [2] عناصر ld+json فالـ DOM = %d (متوقع 1) · raw=%d · payload=%d"
            % (len(dom_matches), len(matches), payload_n)
        )

    blocks = parse_blocks(dom_matches if dom_matches else matches)
    if len(dom_matches) > 1:
        canon = {json.dumps(b, sort_keys=True, ensure_ascii=False) for b in blocks if "_parse_error" not in b}
        if len(canon) == 1:
            print("        → عناصر DOM متطابقين: نفس الكائن متكرر (duplicate حقيقي)")
        types_per = [sorted(collect_types(b, set())) for b in blocks]
        print("        → الأنواع لكل عنصر DOM: %s" % types_per)

    if dump:
        dump_matches(matches)

    types = set()
    for b in blocks:
        collect_types(b, types)
    for want in ("OnlineStore", "WebSite", "SearchAction"):
        p = want in types
        ok &= p
        print("   [%s] [3] %s" % ("OK" if p else "FAIL", want))

    real_blocks = [b for b in blocks if "_parse_error" not in b]
    tpl_ok = False
    if real_blocks:
        tpls = find_url_template(real_blocks[0])
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


def check_product(src, ok_flags, dump=False):
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

    matches = analyze_matches(html)
    dom_matches = [x for x in matches if not x["in_payload"] and not x["in_template"]]
    if dump:
        dump_matches(matches)
    blocks = parse_blocks(dom_matches)
    leak_blocks = 0
    for b in blocks:
        t = collect_types(b, set())
        if "OnlineStore" in t or "WebSite" in t:
            leak_blocks += 1
    p6 = leak_blocks == 0
    ok &= p6
    print(
        "   [%s] [6] تسريب store graph (DOM) = %d (متوقع 0 — Product/Breadcrumb مسموحين)"
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
    dump = "--dump" in args
    home = SITE + "/"
    product = SITE + "/products/36545"
    file_mode = None
    i = 0
    while i < len(args):
        if args[i] == "--file" and i + 1 < len(args):
            file_mode = args[i + 1]
            i += 2
            continue
        if args[i] == "--home" and i + 1 < len(args):
            home = args[i + 1]
            i += 2
            continue
        if args[i] == "--product" and i + 1 < len(args):
            product = args[i + 1]
            i += 2
            continue
        i += 1

    print("═" * 60)
    print("🔍 LACLARC SECTION 3 — JSON-LD VERIFIER v2 (payload-aware)")
    print("═" * 60)

    ok_flags = {"home": False, "product": False}
    if file_mode:
        check_home(file_mode, ok_flags, dump=dump)
    else:
        check_home(home, ok_flags, dump=dump)
        check_product(product, ok_flags, dump=dump)

    print("═" * 60)
    verdict = all(ok_flags.values()) and (file_mode is not None or ok_flags["product"])
    if file_mode:
        verdict = ok_flags["home"]
    print("RESULT: %s" % ("✅ PASS" if verdict else "❌ FAIL"))
    return 0 if verdict else 1


if __name__ == "__main__":
    sys.exit(main())
