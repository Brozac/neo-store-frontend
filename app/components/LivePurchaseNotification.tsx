'use client';

import { useState, useEffect } from 'react';

const buyers = [
  { name: 'Sarah M.', city: '🇩🇿 Algiers' },
  { name: 'Alex K.', city: '🇺🇸 New York' },
  { name: 'Omar B.', city: '🇦🇪 Dubai' },
  { name: 'Chloe D.', city: '🇫🇷 Paris' },
  { name: 'Tariq H.', city: '🇸🇦 Riyadh' },
  { name: 'Lucas W.', city: '🇩🇪 Berlin' },
  { name: 'Yasmine K.', city: '🇩🇿 Oran' },
  { name: 'Emma L.', city: '🇬🇧 London' }
];

export default function LivePurchaseNotification({ productName }: { productName?: string }) {
  const [visible, setVisible] = useState(false);
  const [buyer, setBuyer] = useState({ name: '', city: '', time: '3' });
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!productName || isDismissed) return;

    let hideTimeout: NodeJS.Timeout;
    let nextNotificationTimer: NodeJS.Timeout;

    const triggerNotification = () => {
      const randomBuyer = buyers[Math.floor(Math.random() * buyers.length)];
      const randomMinutes = Math.floor(Math.random() * 25) + 2;

      setBuyer({
        name: randomBuyer.name,
        city: randomBuyer.city,
        time: String(randomMinutes)
      });
      setVisible(true);

      // الإخفاء التلقائي بعد 4.5 ثوانٍ
      hideTimeout = setTimeout(() => {
        setVisible(false);
        // جدول الإشعار التالي بفترة عشوائية طبيعية (18 - 35 ثانية)
        const nextInterval = Math.floor(Math.random() * 17000) + 18000;
        nextNotificationTimer = setTimeout(triggerNotification, nextInterval);
      }, 4500);
    };

    // الظهور الأول بعد 5 ثوانٍ من دخول الصفحة
    const initialDelay = setTimeout(triggerNotification, 5000);

    return () => {
      clearTimeout(initialDelay);
      clearTimeout(hideTimeout);
      clearTimeout(nextNotificationTimer);
    };
  }, [productName, isDismissed]);

  if (!productName || isDismissed) return null;

  return (
    <div 
      className={`fixed bottom-24 sm:bottom-6 left-4 sm:left-6 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-gray-100 flex items-center gap-3 z-30 max-w-[290px] sm:max-w-xs transition-all duration-500 pointer-events-auto ${
        visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      {/* Icon */}
      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg shrink-0 border border-emerald-100 shadow-sm">
        ✓
      </div>
      
      {/* Information */}
      <div className="min-w-0 flex-1 pr-1">
        <p className="text-xs font-black text-gray-900 truncate">
          {buyer.name} <span className="font-normal text-gray-500">from {buyer.city}</span>
        </p>
        <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">
          Purchased <span className="font-bold text-[#8B78C6]">{productName}</span>
        </p>
        <p className="text-[9px] text-gray-400 mt-1 font-semibold uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          {buyer.time}m ago &bull; Verified Order
        </p>
      </div>

      {/* ✨ زر الإغلاق المباشر لمنع إزعاج الزبون */}
      <button 
        type="button"
        onClick={() => {
          setVisible(false);
          setIsDismissed(true); // عدم إزعاجه مرة أخرى أثناء نفس الجلسة
        }}
        className="text-gray-400 hover:text-gray-700 p-1 text-xs self-start transition cursor-pointer"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}