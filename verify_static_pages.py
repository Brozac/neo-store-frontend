#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_static_pages.py — القسم 5 (الصفحات الثابتة) — تحقق حي على laclarc.com بعد الدبل
Usage:
  python3 verify_static_pages.py                # ضد الإنتاج
  python3 verify_static_pages.py --base http://localhost:3000   # ضد dev محلي

المتحقق من:
  [1] 5 صفحات indexable: title خاص + description خاص + canonical مضبوط + og:url مضبوط + بلا noindex
  [2] 5 صفحات noindex: meta robots فيها noindex
  [3] الـ titles كاملين مختلفين (قاتل التكرار)
  [4] sitemap-static.xml: lastmod مثبت
  [5] الهوم ما تبدلش (regression guard)

🩹 v1.1 (25-b): html.unescape قبل المقارنة — &amp; فـ <title> ترميز HTML صحيح،
   ماشي فشل (false positive على /refund فالنسخة الأولى)
"""
import argparse
import html
import re
import sys
import urllib.request
import urllib.error

HOME_DESC_FRAG = "Enjoy Free Worldwide Express Shipping"

# (path, expected_title, expected_canonical)  — canonical بلا الدومين
INDEXABLE = [
    ("/terms",       "Terms of Service | Laclarc",       "/terms"),
    ("/privacy",     "Privacy Policy | Laclarc",         "/privacy"),
    ("/refund",      "Refund & Return Policy | Laclarc", "/refund"),
    ("/track-order", "Track Your Order | Laclarc",       "/track-order"),
    ("/all-products","All Products | Laclarc",           "/all-products"),
]

# صفحات الـ noindex — /review خاصها orderId وهمي (صفحة client كترجع 200 فأي حالة)
NOINDEX = ["/cj-search", "/favorites", "/success", "/cancel", "/review/0"]

PINNED_LASTMOD = "2026-10-19T00:00:00.000Z"

passed, failed, warns = 0, 0, 0

def ok(label: str) -> None:
    global passed
    passed += 1
    print(f"  ✅ {label}")

def fail(label: str, detail: str = "") -> None:
    global failed
    failed += 1
    print(f"  ❌ {label}" + (f" — {detail}" if detail else ""))

def warn(label: str, detail: str = "") -> None:
    global warns
    warns += 1
    print(f"  ⚠️  {label}" + (f" — {detail}" if detail else ""))

def fetch(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; SEO-verify/1.0)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def grab(page_html: str, pattern: str) -> str:
    m = re.search(pattern, page_html, re.I | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""

def head_of(page_html: str) -> str:
    m = re.search(r"<head.*?</head>", page_html, re.I | re.S)
    return m.group(0) if m else page_html[:20000]

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://laclarc.com")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    titles_seen = {}

    print("=" * 78)
    print("القسم 5 — الصفحات الثابتة · تحقق حي على", base)
    print("=" * 78)

    # ── [1] الصفحات القابلة للفهرسة ──────────────────────────────────────
    for path, want_title, want_canon in INDEXABLE:
        print(f"\n▸ {path}  (indexable)")
        try:
            page_html = fetch(base + path)
        except Exception as e:
            fail(f"{path} fetch", str(e))
            continue
        head = head_of(page_html)
        # 🩹 25-b — entities كيرجعو لنصهم قبل المقارنة (&amp; → &):
        # <title>Refund &amp; Return Policy</title> = الترميز الصحيح ديال HTML، ماشي فشل
        title = html.unescape(grab(head, r"<title[^>]*>(.*?)</title>"))
        titles_seen[path] = title
        desc = grab(head, r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']')
        canon = html.unescape(grab(head, r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']'))
        og_url = html.unescape(grab(head, r'<meta\s+property=["\']og:url["\']\s+content=["\']([^"\']+)["\']'))
        robots = grab(head, r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']')

        if title == want_title: ok(f"title = '{want_title}'")
        else: fail("title", f"توقع '{want_title}' — لقينا '{title}'")

        if desc and HOME_DESC_FRAG not in desc: ok(f"description خاصة ({len(desc)} حرف)")
        else: fail("description", "ناقصة ولا مازال كتورث description الهوم")

        if canon.rstrip("/") == (base + want_canon).rstrip("/"): ok(f"canonical = {want_canon}")
        else: fail("canonical", f"توقع {base}{want_canon} — لقينا '{canon or '—'}'")

        if og_url.rstrip("/") == (base + want_canon).rstrip("/"): ok(f"og:url = {want_canon}")
        else: fail("og:url", f"توقع {base}{want_canon} — لقينا '{og_url or '—'}'")

        if "noindex" not in robots.lower(): ok("بلا noindex")
        else: fail("robots", f"كيان noindex فصفحة قابلة للفهرسة: '{robots}'")

    # ── [2] صفحات الـ noindex ────────────────────────────────────────────
    for path in NOINDEX:
        print(f"\n▸ {path}  (noindex)")
        try:
            page_html = fetch(base + path)
        except urllib.error.HTTPError as e:
            warn(f"{path} fetch", f"HTTP {e.code} — لا تحقق يدوي")
            continue
        except Exception as e:
            warn(f"{path} fetch", str(e))
            continue
        head = head_of(page_html)
        robots = grab(head, r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']')
        titles_seen[path] = html.unescape(grab(head, r"<title[^>]*>(.*?)</title>"))
        if "noindex" in robots.lower(): ok(f"robots = '{robots}'")
        else: fail("noindex", f"meta robots مازال '{robots or '—'}'")

    # ── [3] التكرار: العناوين خاصهم يكونو مختلفين ────────────────────────
    print("\n▸ فحص التكرار (titles)")
    dup = {}
    for p, t in titles_seen.items():
        dup.setdefault(t, []).append(p)
    dups = {t: ps for t, ps in dup.items() if len(ps) > 1 and t}
    if dups:
        fail("titles مختلفين", f"مكررين: {dups}")
    else:
        ok(f"{len([t for t in titles_seen.values() if t])} title مختلفين، حتى تكرار")

    # ── [4] sitemap-static.xml ───────────────────────────────────────────
    print("\n▸ /sitemap-static.xml")
    try:
        sm = fetch(base + "/sitemap-static.xml")
        if PINNED_LASTMOD in sm: ok(f"lastmod مثبت = {PINNED_LASTMOD}")
        else: fail("lastmod", f"ما لقيناش {PINNED_LASTMOD} — واش الدبل تدار؟")
    except Exception as e:
        fail("sitemap-static fetch", str(e))

    # ── [5] الهوم سليمة (regression) ─────────────────────────────────────
    print("\n▸ / (regression guard)")
    try:
        home = fetch(base + "/")
        h_title = html.unescape(grab(head_of(home), r"<title[^>]*>(.*?)</title>"))
        if "Laclarc | Curated Lifestyle" in h_title: ok("title الهوم ما تبداش")
        else: warn("title الهوم", f"تغير لـ '{h_title}' — راجع يدوياً")
        h_canon = grab(head_of(home), r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']')
        if not h_canon: ok("الهوم بلا canonical (كيف كانت — القسم 6 يديرها)")
        else: warn("canonical الهوم", f"تزادت: '{h_canon}'")
    except Exception as e:
        warn("home fetch", str(e))

    # ── الحصيلة ──────────────────────────────────────────────────────────
    print("\n" + "=" * 78)
    print(f"الحصيلة: PASS={passed}  FAIL={failed}  WARN={warns}")
    print("🎉 القسم 5: الإنتاج سليم 100%" if failed == 0 else "🚫 القسم 5: كاين فشل — شوف ❌ فوق")
    print("=" * 78)
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
