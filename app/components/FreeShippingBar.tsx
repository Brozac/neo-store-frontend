'use client';

import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';

export default function FreeShippingBar() {
  const { cartTotal } = useCart();
  const FREE_SHIPPING_THRESHOLD = 50; // حدد المبلغ الذي تريد عنده الشحن المجاني
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal);
  const progress = Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="bg-purple-50 p-3 rounded-xl mb-4 border border-purple-100">
      {remaining > 0 ? (
        <p className="text-xs font-bold text-[#1D1E3C] mb-2 text-center">
          Add <span className="text-[#8B78C6]">${remaining.toFixed(2)}</span> more to get <span className="text-emerald-600">FREE Shipping! 🚚</span>
        </p>
      ) : (
        <p className="text-xs font-bold text-emerald-600 mb-2 text-center">
          🎉 You've unlocked FREE Shipping!
        </p>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-[#8B78C6] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}