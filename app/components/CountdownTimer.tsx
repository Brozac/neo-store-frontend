'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 59, seconds: 45 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const DURATION = 3 * 60 * 60 * 1000; // مدة العرض: 3 ساعات
    let endTimeStr = localStorage.getItem('flashSaleEndTime');
    let endTimeNum = endTimeStr ? parseInt(endTimeStr, 10) : NaN;

    // ✨ حماية من التلف والانتهاء: تجديد المؤقت إذا كان تالفاً أو منتهي الصلاحية
    if (isNaN(endTimeNum) || endTimeNum <= Date.now()) {
      endTimeNum = Date.now() + DURATION;
      localStorage.setItem('flashSaleEndTime', endTimeNum.toString());
    }

    const calculateTime = () => {
      const now = Date.now();
      let diff = endTimeNum - now;

      if (diff <= 0) {
        endTimeNum = Date.now() + DURATION;
        localStorage.setItem('flashSaleEndTime', endTimeNum.toString());
        diff = DURATION;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    // ✨ تشغيل الحساب فوراً لتفادي تأخير الثانية الأولى وظهور 00:00:00
    calculateTime();

    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-[#FFEFF5] to-[#FFE0F0] border border-[#FF6B9D]/30 p-3.5 rounded-xl my-4 shadow-sm">
      
      {/* Title & Flash Icon */}
      <div className="flex items-center gap-2">
        <span className="text-base animate-bounce">⚡</span>
        <span className="text-xs font-black text-[#FF6B9D] uppercase tracking-wider">
          Limited Flash Deal Ends in:
        </span>
      </div>

      {/* ✨ أرقام أحادية العرض (tabular-nums) تمنع اهتزاز المؤقت نهائياً */}
      <div className="flex gap-1 items-center font-mono tabular-nums select-none">
        <span className="bg-[#1D1E3C] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {isMounted ? pad(timeLeft.hours) : '02'}
        </span>
        <span className="text-[#1D1E3C] font-black text-xs">:</span>
        <span className="bg-[#1D1E3C] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {isMounted ? pad(timeLeft.minutes) : '59'}
        </span>
        <span className="text-[#1D1E3C] font-black text-xs">:</span>
        <span className="bg-[#1D1E3C] text-white text-xs font-black px-2 py-1 rounded-md shadow-sm min-w-[26px] text-center">
          {isMounted ? pad(timeLeft.seconds) : '45'}
        </span>
      </div>

    </div>
  );
}