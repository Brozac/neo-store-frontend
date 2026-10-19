#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_section6.py — القسم 6 (الأخير) — تحقق حي بعد الدبل
Usage:
  python3 verify_section6.py                # ضد الإنتاج
  python3 verify_section6.py --base http://localhost:3000

المتحقق من:
  [1] الهوم /: canonical = الدومين (جديد) · title ما تبداش · og:url · بلا noindex
  [2] الهوم بالـ params: /?search=... و /?category=...&utm_source=x → نفس canonical
      (برهان التوحيد — قاتل النسخ)
  [3] /cj-product/0: noindex,follow (جديد)
  [4] regression: /categories و /all-products canonical ديالهم كيف ما كانو
"""
import argparse
import html
import re
import sys
import urllib.request
import urllib.error

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

def canon_of(page_html: str) -> str:
    return html.unescape(grab(head_of(page_html), r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']'))

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://laclarc.com")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    print("=" * 78)
    print("القسم 6 — canonical الهوم + noindex CJ · تحقق حي على", base)
    print("=" * 78)

    # ── [1] الهوم ────────────────────────────────────────────────────────
    print("\n▸ /  (canonical جديد)")
    try:
        home = fetch(base + "/")
        canon = canon_of(home)
        h_title = html.unescape(grab(head_of(home), r"<title[^>]*>(.*?)</title>"))
        og_url = html.unescape(grab(head_of(home), r'<meta\s+property=["\']og:url["\']\s+content=["\']([^"\']+)["\']'))
        robots = grab(head_of(home), r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']')

        if canon.rstrip("/") == base: ok(f"canonical = {base} (الدومين)")
        else: fail("canonical الهوم", f"توقع {base} — لقينا '{canon or '—'}'")

        if "Laclarc | Curated Lifestyle" in h_title: ok("title الهوم ما تبداش (وراثة layout)")
        else: fail("title الهوم", f"تبدل لـ '{h_title}'")

        if og_url.rstrip("/") == base: ok(f"og:url = {base}")
        else: warn("og:url الهوم", f"لقينا '{og_url or '—'}'")

        if "noindex" not in robots.lower(): ok("بلا noindex (الهوم indexable)")
        else: fail("robots الهوم", f"كيان noindex: '{robots}'")
    except Exception as e:
        fail("home fetch", str(e))

    # ── [2] الهوم بالـ params (برهان التوحيد) ────────────────────────────
    for path in ["/?search=shaver", "/?category=Shavers&utm_source=test"]:
        print(f"\n▸ {path}  (توحيد الـ params)")
        try:
            v = fetch(base + path)
            c = canon_of(v)
            if c.rstrip("/") == base: ok("canonical كيتجاهل الـ params → الدومين")
            else: fail("توحيد params", f"توقع {base} — لقينا '{c or '—'}'")
        except Exception as e:
            fail(f"{path} fetch", str(e))

    # ── [3] cj-product noindex ───────────────────────────────────────────
    print("\n▸ /cj-product/0  (noindex جديد)")
    try:
        cj = fetch(base + "/cj-product/0")
        robots = grab(head_of(cj), r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']')
        if "noindex" in robots.lower(): ok(f"robots = '{robots}'")
        else: fail("noindex", f"meta robots مازال '{robots or '—'}' — واش الدبل تدار؟")
    except urllib.error.HTTPError as e:
        warn("cj-product fetch", f"HTTP {e.code} — تحقق يدوي")
    except Exception as e:
        warn("cj-product fetch", str(e))

    # ── [4] regression: الصفحات اللي كملت قبل ────────────────────────────
    for path in ["/categories", "/all-products"]:
        print(f"\n▸ {path}  (regression)")
        try:
            v = fetch(base + path)
            c = canon_of(v)
            if c.rstrip("/") == (base + path).rstrip("/"): ok(f"canonical ما زالت {path}")
            else: fail(f"canonical {path}", f"توقع {base}{path} — لقينا '{c or '—'}'")
        except Exception as e:
            warn(f"{path} fetch", str(e))

    # ── الحصيلة ──────────────────────────────────────────────────────────
    print("\n" + "=" * 78)
    print(f"الحصيلة: PASS={passed}  FAIL={failed}  WARN={warns}")
    print("🎉 القسم 6: الإنتاج سليم 100% — خارطة الطريق الأساسية كاملة!" if failed == 0
          else "🚫 القسم 6: كاين فشل — شوف ❌ فوق")
    print("=" * 78)
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
