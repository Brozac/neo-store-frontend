'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useCart, getCartItemKey } from '../context/CartContext';
import PaymentModal from './PaymentModal';
import GlassIcon from '@/components/ui/GlassIcon';

export default function CartWidget() {
  const { cart, removeFromCart, updateQuantity, finalTotal, wheelDiscount, totalItemsCount, isMounted } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 🔑 coupon bridge — نفس مصدر exit-intent/CartPage (sessionStorage) — السيرفر كيعاود يتصادقو fail-closed
  const [couponCode, setCouponCode] = useState<string | undefined>(undefined);

  // 🛡️ sync مع sessionStorage — إلا apply/remove وقع في CartPage، الـ widget كيتابع
  useEffect(() => {
    if (!isMounted) return;
    const syncCoupon = () => {
      const saved = sessionStorage.getItem('laclarc_coupon');
      setCouponCode(saved || undefined);
    };
    syncCoupon();
    // استماع للتغييرات من Tabs أخرى (نادراً — لكن مجاني)
    window.addEventListener('storage', syncCoupon);
    return () => window.removeEventListener('storage', syncCoupon);
  }, [isMounted]);

  // 🔒 الـ hooks كاملين قبل الـ early return (قواعد React — درس CartPage)
  if (!isMounted || cart.length === 0) return null;

  const dec = (itemKey: string, currentQty: number) => {
    // 🔒 حد أدنى: 1 — إلا بغيتي تحيد، استعمل زر ✕ (نمط Amazon)
    updateQuantity(itemKey, Math.max(1, currentQty - 1));
  };

  return (
    // ✨ ضبط الموقع على الهاتف (bottom-24) لتفادي حجب شريط التنقل السفلي
    <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40">

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartItems={cart}
        totalAmount={finalTotal}
        couponCode={couponCode}   // 🔑 الكوبون يتبع الزبون من CartPage للـ Widget
      />

      {isOpen && (
        <div className="bg-white border border-temu-gray-border-light shadow-2xl rounded-2xl p-4 mb-3 w-80 max-h-[420px] overflow-y-auto scrollbar-hide flex flex-col justify-between">

          <div>
            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
              <h3 className="text-sm font-black text-temu-black uppercase tracking-wider">Shopping Bag ({totalItemsCount})</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-black p-1 transition active:scale-90 text-sm"
              >
                <GlassIcon i="x" size="xs" />
              </button>
            </div>

            {/* Items */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cart.map((item) => {
                const itemKey = getCartItemKey(item);
                const itemImg = item.displayImage || item.image_url || item.image || '/placeholder.jpg';
                const itemTitle = item.displayTitle || item.title || item.name || 'Product';

                return (
                  <div key={itemKey} className="flex items-center justify-between gap-2.5 pb-2 border-b border-gray-50">
                    <div className="relative w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                      <Image src={itemImg} alt={itemTitle} fill sizes="48px" className="object-contain p-0.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-temu-black truncate">{itemTitle}</p>
                      <p className="text-[10px] text-gray-400">
                        {item.color && `${item.color} `}
                        {item.size && `(${item.size})`}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          onClick={() => dec(itemKey, item.quantity)}
                          className="w-5 h-5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-xs font-bold active:scale-90"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold text-black px-1">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                          className="w-5 h-5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-xs font-bold active:scale-90"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-12">
                      <button
                        onClick={() => removeFromCart(itemKey)}
                        className="text-gray-300 hover:text-temu-error transition text-xs"
                        aria-label="Remove item"
                      >
                        <GlassIcon i="x" size="xs" />
                      </button>
                      <span className="text-xs font-black text-temu-error">
                        ${(Number(item.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer & Checkout Trigger */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            {wheelDiscount > 0 && (
              <div className="bg-emerald-50 text-emerald-700 text-[10px] font-bold p-1.5 rounded mb-2 text-center">
                <GlassIcon ch="🎉" size="xs" /> Reward Applied: {wheelDiscount}% OFF
              </div>
            )}
            {couponCode && (
              <div className="bg-purple-50 text-[#8B78C6] text-[10px] font-bold p-1.5 rounded mb-2 text-center">
                <GlassIcon ch="🎟️" size="xs" /> Coupon: {couponCode}
              </div>
            )}

            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs font-bold text-gray-500">Subtotal:</span>
              <span className="text-base font-black text-temu-error">${finalTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => { setIsOpen(false); setIsModalOpen(true); }}
              className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition active:scale-95 shadow-md"
            >
              Checkout Now &rarr;
            </button>
          </div>

        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-linear-to-r from-[#1D1E3C] to-[#8B78C6] text-white p-3.5 sm:p-4 rounded-full shadow-2xl hover:scale-105 transition flex items-center justify-center cursor-pointer relative active:scale-90 border-2 border-white/20"
        aria-label="Toggle Shopping Bag"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>

        {totalItemsCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-[#FF6B9D] text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1D1E3C] shadow">
            {totalItemsCount > 99 ? '99+' : totalItemsCount}
          </span>
        )}
      </button>
    </div>
  );
}