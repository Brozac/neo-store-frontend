'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    let endTimeStr = localStorage.getItem('flashSaleEndTime');
    let endTimeNum: number;

    if (!endTimeStr) {
      endTimeNum = Date.now() + 3 * 60 * 60 * 1000; // 3 ساعات
      localStorage.setItem('flashSaleEndTime', endTimeNum.toString());
    } else {
      endTimeNum = parseInt(endTimeStr, 10);
    }

    const timer = setInterval(() => {
      const diff = endTimeNum - Date.now();
      
      if (diff <= 0) {
        endTimeNum = Date.now() + 3 * 60 * 60 * 1000;
        localStorage.setItem('flashSaleEndTime', endTimeNum.toString());
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    // ✨ توحيد الألوان: خلفية وردية فاتحة، نص بنفسجي، ومربعات كحلية
    <div className="flex items-center justify-between bg-temu-yellow-soft border border-temu-gold p-3 rounded-temu-sm my-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span className="text-xs font-extrabold text-temu-error uppercase tracking-wide">Flash Sale Ends in</span>
      </div>
      <div className="flex gap-1 items-center">
        <span className="bg-temu-black text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.hours)}</span>
        <span className="text-temu-black font-bold">:</span>
        <span className="bg-temu-black text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.minutes)}</span>
        <span className="text-temu-black font-bold">:</span>
        <span className="bg-temu-black text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.seconds)}</span>
      </div>
    </div>
  );
}