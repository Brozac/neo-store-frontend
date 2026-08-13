'use client';

import { useState, useEffect } from 'react';

const names = ['Sarah', 'Ahmed', 'Jessica', 'Omar', 'Maria', 'Li', 'David', 'Fatima'];
const cities = ['🇩🇿 Algiers', '🇺🇸 New York', '🇦🇪 Dubai', '🇫🇷 Paris', '🇸🇦 Riyadh', '🇩🇪 Berlin'];

export default function LivePurchaseNotification({ productName }: { productName: string }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState({ name: '', city: '', time: '' });

  useEffect(() => {
    const showNotification = () => {
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomTime = Math.floor(Math.random() * 30) + 1;
      
      setInfo({ name: randomName, city: randomCity, time: randomTime.toString() });
      setVisible(true);

      setTimeout(() => setVisible(false), 5000);
    };

    const initialTimer = setTimeout(showNotification, 4000);
    const interval = setInterval(showNotification, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [productName]);

  return (
    <div 
      className={`fixed bottom-5 left-5 bg-white p-3 rounded-2xl shadow-2xl border border-gray-100 flex items-center gap-3 z-40 max-w-75 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl shrink-0">
        ✅
      </div>
      {/* ✨ أضفنا min-w-0 هنا لكي تسمح للنص بالتقلص */}
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#1D1E3C] truncate">
          {info.name} from {info.city}
        </p>
        {/* ✨ أضفنا break-words و line-clamp-2 لجعل الاسم الطويل ينتقل لسطر جديد */}
        <p className="text-[10px] text-gray-500 wrap-break-word line-clamp-2">
          just bought <span className="font-bold text-[#8B78C6]">{productName}</span>
        </p>
        <p className="text-[10px] text-gray-400 mt-1">{info.time} minutes ago • Verified ✓</p>
      </div>
    </div>
  );
}