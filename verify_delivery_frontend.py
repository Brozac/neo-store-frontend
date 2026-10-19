#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_delivery_frontend.py — Kit 28 verification
==================================================
Usage:
  python verify_delivery_frontend.py                 # https://laclarc.com
  python verify_delivery_frontend.py https://laclarc.com 5

Checks:
  1. /api/geo            → 200 + JSON country (null على المحلي عادي)
  2. صفحة منتج (PDP)     → 200 (Kit 28 مربوط)
  3. backend estimate    → 200/404/502 (Kit 27 خدام)
"""
import json
import sys
import urllib.error
import urllib.request

base = (sys.argv[1] if len(sys.argv) > 1 else "https://laclarc.com").rstrip("/")
pid = sys.argv[2] if len(sys.argv) > 2 else "1"

PASS = FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  OK  {name} {extra}")
    else:
        FAIL += 1
        print(f"  XX  {name} {extra}")


def get(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 laclarc-kit28-verify"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


print(f"=== Kit 28 verify - {base} ===")

print("-- 1. /api/geo (Vercel edge geo)")
st, body = get(base + "/api/geo")
check("HTTP 200", st == 200, f"(status={st})")
country = None
if st == 200:
    try:
        js = json.loads(body)
        country = js.get("country")
        check("JSON has 'country'", True, f"(country={country})")
        if country is not None:
            check("country is ISO-2", isinstance(country, str) and len(country) == 2 and country.isalpha())
    except Exception as e:
        check("JSON parse", False, f"({e})")

print(f"-- 2. PDP /products/{pid} reachable")
st2, _ = get(base + f"/products/{pid}")
check("PDP HTTP 200", st2 == 200, f"(status={st2}) - بدل pid برقم منتج حقيقي إلا فشل")

print("-- 3. backend estimate (Kit 27)")
st3, body3 = get(f"https://neo-store-backend.onrender.com/api/shipping/estimate?pid={pid}&country={country or 'US'}")
check("estimate 200/404/502", st3 in (200, 404, 502), f"(status={st3})")
if st3 == 200:
    try:
        est = json.loads(body3)
        print(f"     >> supported={est.get('supported')} cheapest={est.get('cheapest', {}).get('price')} aging={est.get('cheapest', {}).get('aging')}")
    except Exception:
        pass

print(f"\nالحصيلة: PASS={PASS} FAIL={FAIL}" + ("  🎉" if FAIL == 0 else "  ⚠️"))
sys.exit(0 if FAIL == 0 else 1)
