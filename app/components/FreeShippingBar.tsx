'use client';

import { useCart } from '../context/CartContext';

export default function FreeShippingBar() {
  const { cartTotal, isMounted } = useCart();
  
  // ✨ عتبة تجارية واقعية لترقية الشحن إلى Express الممتاز لزيادة المبيعات
  const EXPRESS_SHIPPING_THRESHOLD = 69.00;
  const currentTotal = isMounted ? cartTotal : 0;
  const remaining = Math.max(0, EXPRESS_SHIPPING_THRESHOLD - currentTotal);
  const progress = Math.min(100, (currentTotal / EXPRESS_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3.5 rounded-2xl mb-4 border border-[#8B78C6]/20 shadow-sm">
      {remaining > 0 ? (
        <p className="text-xs font-bold text-[#1D1E3C] mb-2 text-center">
          Add <span className="text-[#FF6B9D] font-black">${remaining.toFixed(2)}</span> more to unlock <span className="text-[#8B78C6] font-black">Free Express Delivery (3–7 Days) 🚀</span>
        </p>
      ) : (
        <p className="text-xs font-black text-emerald-700 mb-2 text-center flex items-center justify-center gap-1.5 animate-pulse">
          <span>🎉</span> You&apos;ve Unlocked FREE Worldwide Priority Express!
        </p>
      )}

      {/* Progress Track */}
      <div className="w-full bg-gray-200/80 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-[#8B78C6] to-[#FF6B9D] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}