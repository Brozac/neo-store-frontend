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
    <div className="flex items-center justify-between bg-purple-50 border border-purple-100 p-3 rounded-xl my-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span className="text-xs font-extrabold text-[#8B78C6] uppercase tracking-wide">Flash Sale Ends in</span>
      </div>
      <div className="flex gap-1 items-center">
        <span className="bg-[#1D1E3C] text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.hours)}</span>
        <span className="text-[#1D1E3C] font-bold">:</span>
        <span className="bg-[#1D1E3C] text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.minutes)}</span>
        <span className="text-[#1D1E3C] font-bold">:</span>
        <span className="bg-[#1D1E3C] text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">{pad(timeLeft.seconds)}</span>
      </div>
    </div>
  );
}