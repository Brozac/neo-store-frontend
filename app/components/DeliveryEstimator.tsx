'use client';

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
