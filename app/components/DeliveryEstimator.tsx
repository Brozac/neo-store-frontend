'use client';

import { useState, useEffect } from 'react';

export default function DeliveryEstimator() {
  const [deliveryDates, setDeliveryDates] = useState({
    start: '', end: '', hoursLeft: 4, minsLeft: 32,
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const calculateDates = () => {
      const today = new Date();

      // موعد الوصول الأول (بعد 7 أيام)
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 7);

      // موعد الوصول الأقصى (بعد 12 يوماً)
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 12);

      const formatOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

      // حساب الساعات المتبقية لإرسال شحنات اليوم (قبل نهاية الساعة 20:00)
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

    calculateDates();

    // 🩹 FIX — live minute-tick: العدّاد يعيش ويحدّث التواريخ لو غيّر اليوم
    const timer = setInterval(calculateDates, 60000);

    return () => clearInterval(timer);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-2xl p-4 my-4 space-y-3 font-sans">

      {/* سطر موعد الوصول الدقيق */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white text-[#8B78C6] flex items-center justify-center text-base shrink-0 border border-[#8B78C6]/20 shadow-xs">
          ✈️
        </div>
        <div className="text-xs leading-relaxed">
          <p className="font-bold text-gray-900">
            Estimated Delivery:{' '}
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