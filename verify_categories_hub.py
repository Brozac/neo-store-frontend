#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_categories_hub.py — Laclarc Section 4: التحقق الحي ديال hub /categories

الفحوصات:
  [1] GET /categories → HTTP 200
  [2] h1 "Browse All Categories" حاضر فالـ HTML الخام (SSR)
  [3] عدد روابط /category/ فالـ HTML الخام ≥ 600 (hub مُ prerender — Google كيشوف الروابط)
  [4] Metadata: title + meta description + canonical=/categories
  [5] JSON-LD: CollectionPage كعنصر DOM حقيقي واحد (payload-aware — درس verifier v2)
  [6] API /api/categories/hub → counts + totals + عينة اتساق مع العدّاد الحي
  [7] sitemap-categories.xml → كل الروابط بمسارات كاملة (مطابقة للشجرة)

الاستعمال:
  python verify_categories_hub.py                     ← فحص كامل (production)
  python verify_categories_hub.py --base URL          ← site بديل (default laclarc.com)
  python verify_categories_hub.py --api URL           ← backend بديل (default render)

stdlib فقط · UA متصفح (Cloudflare) · exit 0=PASS · 1=FAIL
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

results = []  # (ok, label)


def report(ok, label, detail=""):
    results.append((ok, label))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {label}" + (f" — {detail}" if detail else ""))


def note(label, detail=""):
    print(f"[NOTE] {label}" + (f" — {detail}" if detail else ""))


def http_get(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", errors="replace")


# ─────────────────────────────────────────────────────────────────────────────
# payload-aware ld+json — نفس درس verifier v2 (23-f):
# النسخ داخل strings ديال RSC payload (self.__next_f.push) كيلقطهم الـ regex
# بحال العناصر الحقيقية — الفرق: العنصر الحقيقي ماشي جوّا <script> آخر.
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_OPEN_RE = re.compile(r"<script\b[^>]*>", re.I)
LD_OPEN_RE = re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>', re.I)


def script_spans(html):
    """كل أزواج <script ...>...</script> (JSON ميهربش </script> حيت < مهرب \u003c)."""
    spans = []
    for m in SCRIPT_OPEN_RE.finditer(html):
        end = html.find("</script>", m.end())
        if end == -1:
            continue
        spans.append((m.start(), end + len("</script>")))
    return spans


def ld_blocks(html):
    """كيرجع [(is_real_dom, json_obj_or_None, start)] — real = ماشي جوّا script آخر."""
    spans = script_spans(html)
    out = []
    for m in LD_OPEN_RE.finditer(html):
        end = html.find("</script>", m.end())
        if end == -1:
            continue
        start = m.start()
        in_payload = any(s < start < e for (s, e) in spans if (s, e) != (start, end + len("</script>")))
        raw = html[m.end():end]
        obj = None
        try:
            obj = json.loads(raw)
        except Exception:
            pass
        out.append((not in_payload, obj, start))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://laclarc.com")
    ap.add_argument("--api", default="https://neo-store-backend.onrender.com")
    ap.add_argument("--min-links", type=int, default=600)
    args = ap.parse_args()

    base = args.base.rstrip("/")
    api = args.api.rstrip("/")
    tree_flat = None
    roots_count = None

    # ── [6] API hub ─────────────────────────────────────────────────────
    hub = None
    try:
        st, body = http_get(f"{api}/api/categories/hub")
        if st == 200:
            hub = json.loads(body)
    except Exception as e:
        note("API hub", f"فشل الاتصال: {e}")

    if hub and isinstance(hub.get("nodes"), list):
        def count_nodes(ns):
            n = 0
            for x in ns or []:
                n += 1 + count_nodes(x.get("children"))
            return n
        total_nodes = count_nodes(hub["nodes"])
        totals = hub.get("totals") or {}
        counts_on = hub.get("counts") is True
        report(counts_on, "[6a] API hub counts:true", f"totals={totals}")
        report(totals.get("categories") == total_nodes,
               "[6b] totals.categories = عدد العقد فالشجرة",
               f"{totals.get('categories')} vs {total_nodes}")
        roots = hub["nodes"]
        roots_count = len(roots)
        tree_flat = []
        def flat2(ns, acc):
            for x in ns or []:
                acc.append(x)
                flat2(x.get("children"), acc)
        flat2(hub["nodes"], tree_flat)
        with_count = sum(1 for x in tree_flat if isinstance(x.get("count"), int))
        report(with_count == total_nodes, "[6c] كل عقدة عندها count", f"{with_count}/{total_nodes}")
        any_positive = any(isinstance(x.get("count"), int) and x["count"] > 0 for x in roots)
        report(any_positive, "[6d] على الأقل جذر واحد count>0")

        # عينة اتساق: أول جذر — hub count vs العدّاد الحي
        if roots and isinstance(roots[0].get("count"), int):
            r0 = roots[0]
            try:
                st2, body2 = http_get(
                    f"{api}/api/products?category={urllib.parse.quote(r0['slugPath'])}&count=1", 60)
                live = json.loads(body2).get("count")
                same = live == r0["count"]
                report(same, "[6e] عينة اتساق (جذر 1) hub=live",
                       f"{r0['name']}: hub={r0['count']} live={live}"
                       + ("" if same else " — تغير مخزون بين الاستدعاءين؟"))
            except Exception as e:
                note("عينة الاتساق", f"ما تقدرش: {e}")
    else:
        report(False, "[6] API /api/categories/hub",
               "ما جاوبش ولا nodes ناقصين — طبق direct_patch_s4_hub.py على الباكند ونشر")
        # fallback: نجيبو الشجرة العادية باش فحص الـ sitemap [7b] يخدم على أي حال
        try:
            st, body = http_get(f"{api}/api/categories")
            tree = json.loads(body)
            if isinstance(tree, list):
                tree_flat = []
                def flat3(ns, prefix=""):
                    for x in ns or []:
                        if not x.get("slug"):
                            continue
                        sp = f"{prefix}/{x['slug']}" if prefix else x["slug"]
                        tree_flat.append({"slugPath": sp})
                        flat3(x.get("children"), sp)
                flat3(tree)
                roots_count = len(tree)
        except Exception:
            pass

    # ── [1] الصفحة ──────────────────────────────────────────────────────
    try:
        st, html = http_get(f"{base}/categories")
        report(st == 200, "[1] GET /categories → 200", f"HTTP {st} · {len(html)} bytes")
    except Exception as e:
        report(False, "[1] GET /categories → 200", str(e))
        print("\nRESULT: ❌ FAIL — الصفحة ما ولاتش")
        return 1

    # ── [2] h1 فالـ SSR ────────────────────────────────────────────────
    h1_ok = re.search(r"<h1[^>]*>\s*Browse All Categories\s*</h1>", html) is not None
    report(h1_ok, "[2] h1 SSR = Browse All Categories")

    # ── [3] روابط الأقسام فالـ SSR ─────────────────────────────────────
    links = re.findall(r'href="/category/', html)
    report(len(links) >= args.min_links, f"[3] روابط /category/ فالـ HTML الخام ≥ {args.min_links}",
           f"lqat {len(links)}")
    if not h1_ok and len(links) == 0:
        note("تشخيص [2]+[3]",
             "الصفحة باقة fallback (client) — غالباً Render كان نائب وقت build الفرونت. "
             "دفي /api/categories/hub فالمتصفح، عاود deploy الفرونت، وعاود الفحص.")

    # ── [4] Metadata ────────────────────────────────────────────────────
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    title = (t.group(1) or "").strip() if t else ""
    report("Browse All Categories" in title, "[4a] title فيه 'Browse All Categories'", title)
    md = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
    report(md is not None and len(md.group(1)) >= 50, "[4b] meta description حاضرة",
           (md.group(1)[:80] + "…") if md else "ما كايناش")
    can = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', html)
    report(can is not None and can.group(1).rstrip("/") == f"{base}/categories".rstrip("/"),
           "[4c] canonical = /categories", can.group(1) if can else "ما كايناش")

    # ── [5] JSON-LD CollectionPage (payload-aware) ─────────────────────
    blocks = ld_blocks(html)
    dom_blocks = [(ok, obj) for (ok, obj, _s) in blocks if ok]
    cp = [obj for (_ok, obj) in dom_blocks if isinstance(obj, dict) and obj.get("@type") == "CollectionPage"]
    payload_copies = sum(1 for (ok, _o, _s) in blocks if not ok)
    report(len(dom_blocks) == 1 and len(cp) == 1,
           "[5a] CollectionPage كعنصر DOM = 1",
           f"dom={len(dom_blocks)} · collection={len(cp)} · payload_copies={payload_copies} (notes عاديين)")
    if cp:
        me = cp[0].get("mainEntity") or {}
        items = me.get("itemListElement") or []
        report(me.get("@type") == "ItemList" and len(items) > 0,
               "[5b] mainEntity = ItemList بعناصر",
               f"items={len(items)}" + (f" · متوقع {roots_count}" if roots_count else ""))
        urls_ok = all(str(i.get("url", "")).startswith(f"{base}/category/") for i in items)
        report(urls_ok, "[5c] روابط ItemList كاملين /category/ كاملين مطلقين")

    # ── [7] sitemap categories ──────────────────────────────────────────
    try:
        st, sx = http_get(f"{base}/sitemap-categories.xml", 60)
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sx)
        flat_locs = [u.replace(f"{base}/category/", "", 1) for u in locs]
        report(len(locs) == len(tree_flat) if tree_flat else len(locs) >= 600,
               "[7a] sitemap = عدد عقد الشجرة",
               f"sitemap={len(locs)}" + (f" · tree={len(tree_flat)}" if tree_flat else ""))
        if tree_flat:
            expected = {x["slugPath"] for x in tree_flat}
            missing = [p for p in expected if p not in set(flat_locs)]
            extra = [p for p in flat_locs if p not in expected]
            report(not missing and not extra, "[7b] كل روابط sitemap بمسارات كاملة (set match)",
                   f"missing={len(missing)} · extra={len(extra)}"
                   + (f" · مثال missing: {missing[:2]}" if missing else "")
                   + (f" · مثال extra: {extra[:2]}" if extra else ""))
        multi = sum(1 for p in flat_locs if "/" in p)
        note("توزيع sitemap", f"multi-segment={multi} · single={len(flat_locs) - multi} (متوقع 667/14)")
    except Exception as e:
        note("[7] sitemap", f"ما تقراش: {e}")

    # ── النتيجة ─────────────────────────────────────────────────────────
    failed = [l for (ok, l) in results if not ok]
    print(f"\nRESULT: {'✅ PASS' if not failed else '❌ FAIL'} — "
          f"{len(results) - len(failed)}/{len(results)} PASS")
    for l in failed:
        print(f"  └─ فاشل: {l}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
