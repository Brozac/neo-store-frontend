'use client';

import { useState, useEffect } from 'react';
import GlassIcon from '@/components/ui/GlassIcon';

/**
 * ⚡ Flash Deal Timer — v2.1 (Honest Edition + TS-safe)
 * جلسة حقيقية تنتهي إلى نهاية اليوم UTC (لحظة تجدد أسعار CJ فعلياً — cron 03:00)
 * عند الانتهاء: يختفي — لا إعادة تعبئة خفية
 */
export default function CountdownTimer({ hoursLeft = 0 }: { hoursLeft?: number }) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null);
  const [expired, setExpired] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const sessionKey = 'flashDealSessionUTC';
    let endTimeStr = localStorage.getItem(sessionKey);
    let endTimeNum = endTimeStr ? parseInt(endTimeStr, 10) : NaN;

    const isSameUtcDay = (ts: number) => {
      const a = new Date(ts), b = new Date();
      return a.getUTCDate() === b.getUTCDate() && a.getUTCMonth() === b.getUTCMonth();
    };

    if (isNaN(endTimeNum) || !isSameUtcDay(endTimeNum) || endTimeNum <= Date.now()) {
      const end = new Date();
      end.setUTCHours(24, 0, 0, 0);
      endTimeNum = end.getTime();
      localStorage.setItem(sessionKey, endTimeNum.toString());
    }

    const calculateTime = () => {
      const diff = endTimeNum - Date.now();
      if (diff <= 0) {
        setExpired(true);
        return;
      }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (num: number) => num.toString().padStart(2, '0');

  // 🩹 TS-safe — أي حالة غير جاهزة = شريط SSR-neutral، وبعد انتهاء الجلسة = يختفي
  if (!isMounted || expired || !timeLeft) {
    if (expired) return null;

    return (
      <div className="flex items-center justify-between bg-linear-to-r from-[#F7F4FC] to-[#F1EBFA] border border-[#7E56C4]/30 p-3.5 rounded-xl my-4 shadow-sm">
        <span className="text-xs font-black text-[#7E56C4] uppercase tracking-wider"><GlassIcon i="zap" size="xs" /> Flash Deal — Today Only (ends 00:00 UTC)</span>
      </div>
    );
  }

  // بعد هذا السطر: isMounted ✓ && !expired ✓ && timeLeft ✓ — TS يثق الآن
  return (
    <div className="flex items-center justify-between bg-linear-to-r from-[#F7F4FC] to-[#F1EBFA] border border-[#7E56C4]/30 p-3.5 rounded-xl my-4 shadow-sm">

      <div className="flex items-center gap-2">
        <span className="text-base animate-bounce"><GlassIcon i="zap" size="xs" /></span>
        <span className="text-xs font-black text-[#7E56C4] uppercase tracking-wider">
          Flash Deal Ends in:
        </span>
      </div>

      <div className="flex gap-1 items-center font-mono tabular-nums select-none">
        <span className="bg-[#17171A] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {pad(timeLeft.h)}
        </span>
        <span className="text-[#17171A] font-black text-xs">:</span>
        <span className="bg-[#17171A] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {pad(timeLeft.m)}
        </span>
        <span className="text-[#17171A] font-black text-xs">:</span>
        <span className="bg-[#17171A] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {pad(timeLeft.s)}
        </span>
      </div>

    </div>
  );
}