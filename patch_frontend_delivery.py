#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_frontend_delivery.py — Kit 28 (Worldwide Live Delivery Estimator)
=======================================================================
يخدم من جذر الـ frontend (المجلد اللي فيه next.config.ts)

3 خطوات (جراحية):
  1. جديد  : app/api/geo/route.ts — دولة الزائر من Vercel edge geo header
  2. تعويض : app/components/DeliveryEstimator.tsx — v2 عالمي:
       · كيجيب الدولة أوتوماتيكياً (/api/geo)
       · كيجيب تقدير حقيقي من الـ backend (Kit 27): /api/shipping/estimate
       · أي فشل = يرجع للوضع القديم (7-12 يوم) بلا حتى مشكل ظاهر
  3. لصقة  : ProductDetailsClient.tsx — <DeliveryEstimator /> →
             <DeliveryEstimator productId={product.id} />

Backup تلقائي: *.bak-kit28. الأنكورات مفحوصين — إلا تبدلو: إيقاف بلا تعديل.
"""
import os
import sys
import shutil

BACKUP_SUFFIX = ".bak-kit28"

GEO_ROUTE_TS = """// app/api/geo/route.ts — Kit 28: دولة الزائر (Vercel edge geo)
// كيرجع ISO-2 (مثلا MA) ولا null فالتطوير المحلي — الواجهة كتعالج الجوج
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    '';
  return NextResponse.json(
    { country: raw ? raw.toUpperCase().slice(0, 2) : null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
"""

DELIVERY_ESTIMATOR_V2 = """'use client';

import { useState, useEffect } from 'react';

// Kit 28 — v2 عالمي: دولة الزائر أوتوماتيكياً (Vercel geo) + تقدير حقيقي
// من الـ backend (freightCalculate حي مع cache 6 ساعات).
// أي فشل (geo خاوي / backend طايح / دولة غير مدعومة) = الوضع القديم 7-12
// يوم — الزائر عمرو ما يشوف خطأ.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
const FALLBACK_DAYS: [number, number] = [7, 12];

export default function DeliveryEstimator({ productId }: { productId?: number | string | null }) {
  const [deliveryDates, setDeliveryDates] = useState({
    start: '', end: '', hoursLeft: 4, minsLeft: 32,
  });
  const [daysRange, setDaysRange] = useState<[number, number]>(FALLBACK_DAYS);
  const [country, setCountry] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ⏱️ حساب التواريخ (حقيقيين إلا جات داتا live، وإلا 7-12)
  useEffect(() => {
    if (!isMounted) return;

    const calculateDates = ([minDays, maxDays]: [number, number]) => {
      const today = new Date();

      const startDate = new Date(today);
      startDate.setDate(today.getDate() + minDays);

      const endDate = new Date(today);
      endDate.setDate(today.getDate() + maxDays);

      const formatOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

      // العدّاد: شحنات اليوم قبل نهاية الساعة 20:00
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(20, 0, 0, 0);

      let diffMs = cutoff.getTime() - now.getTime();
      if (diffMs <= 0) {
        cutoff.setDate(cutoff.getDate() + 1);
        diffMs = cutoff.getTime() - now.getTime();
      }

      const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
      const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      setDeliveryDates({
        start: startDate.toLocaleDateString('en-US', formatOptions),
        end: endDate.toLocaleDateString('en-US', formatOptions),
        hoursLeft,
        minsLeft,
      });
    };

    calculateDates(daysRange);
    const timer = setInterval(() => calculateDates(daysRange), 60000);
    return () => clearInterval(timer);
  }, [isMounted, daysRange]);

  // 🌍 Kit 28 — الدولة أوتوماتيكياً + التقدير الحقيقي من CJ (Kit 27 backend)
  useEffect(() => {
    if (!isMounted || productId == null || productId === '') return;
    let cancelled = false;

    (async () => {
      try {
        const geoRes = await fetch('/api/geo', { cache: 'no-store' });
        if (!geoRes.ok || cancelled) return;
        const geo = (await geoRes.json()) as { country: string | null };
        if (!geo.country || cancelled) return;
        setCountry(geo.country);

        const estRes = await fetch(
          `${API_BASE}/api/shipping/estimate?pid=${encodeURIComponent(String(productId))}&country=${encodeURIComponent(geo.country)}`,
          { cache: 'no-store' }
        );
        if (!estRes.ok || cancelled) return;
        const est = (await estRes.json()) as {
          supported?: boolean;
          agingDays?: { min: number; max: number } | null;
        };
        if (cancelled) return;

        if (
          est.supported === true &&
          est.agingDays &&
          est.agingDays.min > 0 &&
          est.agingDays.max >= est.agingDays.min
        ) {
          // سقف وصفي 60 يوم — حماية من قيم CJ الشاذة
          setDaysRange([est.agingDays.min, Math.min(est.agingDays.max, 60)]);
        }
        // غير مدعومة / بلا agingDays → نبقى على 7-12 (صامت)
      } catch {
        /* صامت — fallback static */
      }
    })();

    return () => { cancelled = true; };
  }, [isMounted, productId]);

  if (!isMounted) return null;

  return (
    <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-2xl p-4 my-4 space-y-3 font-sans">

      {/* سطر موعد الوصول — حقيقي (دولة الزائر من CJ) أو العام */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white text-[#8B78C6] flex items-center justify-center text-base shrink-0 border border-[#8B78C6]/20 shadow-xs">
          ✈️
        </div>
        <div className="text-xs leading-relaxed">
          <p className="font-bold text-gray-900">
            {country ? `Estimated Delivery to ${country}: ` : 'Estimated Delivery: '}
            <span className="text-[#8B78C6] font-black underline decoration-[#8B78C6]/40 underline-offset-2">
              {deliveryDates.start} – {deliveryDates.end}
            </span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
            Order within <strong className="text-emerald-700 font-bold">{deliveryDates.hoursLeft}h {deliveryDates.minsLeft}m</strong> — ships within 24–48h via CJ.
          </p>
        </div>
      </div>

      {/* شريط مؤشرات الثقة الأربعة */}
      <div className="pt-3 border-t border-[#8B78C6]/15 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>Free Worldwide Shipping</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>30-Day Money-Back Guarantee</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>Direct Factory Insured</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>256-Bit SSL Encrypted</span>
        </div>
      </div>

    </div>
  );
}
"""

ANCHOR_PDP = "<DeliveryEstimator />"
PDP_REPLACEMENT = "<DeliveryEstimator productId={product.id} />"


def read_file(path: str) -> str:
    with open(path, "rb") as f:
        return f.read().decode("utf-8")


def write_file(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(text.encode("utf-8"))


def backup(path: str) -> None:
    bak = path + BACKUP_SUFFIX
    if os.path.exists(bak):
        os.remove(bak)
    shutil.copy2(path, bak)


def flexible_find(text: str, anchor: str):
    idx = text.find(anchor)
    if idx != -1:
        return idx, anchor
    crlf_anchor = anchor.replace("\n", "\r\n")
    idx = text.find(crlf_anchor)
    if idx != -1:
        return idx, crlf_anchor
    return None, None


def main() -> None:
    if not os.path.exists("next.config.ts") or not os.path.isdir("app"):
        print("❌ خدم من جذر الـ frontend (المجلد اللي فيه next.config.ts)")
        sys.exit(1)

    print("═══ 🌍 Kit 28 — Worldwide Live Delivery Estimator ═══\n")

    # 1) app/api/geo/route.ts — جديد
    geo_path = os.path.join("app", "api", "geo", "route.ts")
    if os.path.exists(geo_path):
        if read_file(geo_path) == GEO_ROUTE_TS:
            print("⚪ geo route موجود بحاله — تخطى")
        else:
            backup(geo_path)
            write_file(geo_path, GEO_ROUTE_TS)
            print(f"♻️  overwrote: {geo_path} (backup .bak-kit28)")
    else:
        write_file(geo_path, GEO_ROUTE_TS)
        print(f"✅ created: {geo_path}")

    # 2) DeliveryEstimator.tsx — تعويض كامل (ملفنا، 101 سطر، خطر واطي)
    est_path = os.path.join("app", "components", "DeliveryEstimator.tsx")
    current = read_file(est_path)
    if current == DELIVERY_ESTIMATOR_V2:
        print("⚪ DeliveryEstimator v2 موجود بحاله — تخطى")
    else:
        backup(est_path)
        write_file(est_path, DELIVERY_ESTIMATOR_V2)
        print(f"✅ replaced: {est_path} (backup .bak-kit28)")

    # 3) ProductDetailsClient.tsx — لصقة prop
    pdp_path = os.path.join("app", "products", "[id]", "ProductDetailsClient.tsx")
    text = read_file(pdp_path)
    idx, matched = flexible_find(text, ANCHOR_PDP)
    if idx is None:
        if PDP_REPLACEMENT in text:
            print("⚪ PDP مربوط من قبل — تخطى")
        else:
            print("❌ ANCHOR NOT FOUND في ProductDetailsClient.tsx — تواصل مع Z.ai")
            sys.exit(1)
    elif text.count(matched) != 1:
        print(f"❌ ANCHOR NOT UNIQUE ({text.count(matched)}×) — تواصل مع Z.ai")
        sys.exit(1)
    else:
        backup(pdp_path)
        write_file(pdp_path, text[:idx] + PDP_REPLACEMENT + text[idx + len(matched):])
        print(f"✅ patched: {pdp_path}")

    print("""
═══ ✅ Kit 28 تطبق ═══

الخطوات الجاية:
  1. npm run build        ← خاصو يدوز بلا أخطاء
  2. git add app/api/geo app/components/DeliveryEstimator.tsx "app/products/[id]/ProductDetailsClient.tsx"
  3. git commit -m "Kit28: worldwide live delivery estimator (Vercel geo + CJ freight)"
  4. git push             ← Vercel يبني بوحدو
  5. python verify_delivery_frontend.py https://laclarc.com
""")


if __name__ == "__main__":
    main()
