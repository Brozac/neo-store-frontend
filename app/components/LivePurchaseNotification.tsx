'use client';

import { useState, useEffect } from 'react';

const names = ['Sarah', 'Ahmed', 'Jessica', 'Omar', 'Maria', 'Li', 'David', 'Fatima'];
const cities = ['🇩🇿 Algiers', '🇺🇸 New York', '🇦🇪 Dubai', '🇫🇷 Paris', '🇸🇦 Riyadh', '🇩🇪 Berlin'];

export default function LivePurchaseNotification({ productName }: { productName: string }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState({ name: '', city: '', time: '' });

  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;

    const showNotification = () => {
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomTime = Math.floor(Math.random() * 30) + 1;
      
      setInfo({ name: randomName, city: randomCity, time: randomTime.toString() });
      setVisible(true);

      // ✨ تخزين الـ Timeout في متغير ليتم تنظيفه لاحقاً
      hideTimeout = setTimeout(() => setVisible(false), 5000);
    };

    const initialTimer = setTimeout(showNotification, 4000);
    const interval = setInterval(showNotification, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      // ✨ تنظيف مؤقت الإخفاء لمنع تسرب الذاكرة عند الخروج من الصفحة
      clearTimeout(hideTimeout); 
    };
  }, [productName]);

  return (
    <div 
      className={`fixed bottom-20 sm:bottom-5 left-5 bg-white p-3 rounded-temu-sm shadow-2xl border border-temu-gray-border-light flex items-center gap-3 z-40 max-w-[280px] sm:max-w-xs transition-all duration-500 touch-manipulation ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      <div className="w-10 h-10 bg-temu-green-light/10 rounded-full flex items-center justify-center text-xl shrink-0">
        ✅
      </div>
      
      <div className="min-w-0">
        <p className="text-xs font-bold text-temu-black truncate">
          {info.name} from {info.city}
        </p>
        <p className="text-[10px] text-temu-gray-text wrap-break-word line-clamp-2">
          just bought <span className="font-bold text-temu-orange">{productName}</span>
        </p>
        <p className="text-[10px] text-temu-gray-light mt-1">{info.time} minutes ago • Verified ✓</p>
      </div>
    </div>
  );
}