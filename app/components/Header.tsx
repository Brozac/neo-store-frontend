'use client';

import { useCart } from '../context/CartContext';
import { useState } from 'react';
import Link from 'next/link';

export default function Header({ showBack = false }: { showBack?: boolean }) {
  const { cart, finalTotal } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  // ✨ استخدام finalTotal إذا كان موجوداً (لدعم خصم عجلة الحظ)
  const total = finalTotal || cart.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);
  const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    try {
      // ✨ إرسال التوكن لربط الطلب بحساب الزبون
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('https://neo-store-backend.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          items: cart,
          origin: window.location.origin // ✨ ضروري لإنشاء رابط النجاح/الإلغاء في Stripe
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center px-6 pt-12 pb-6 max-w-md mx-auto md:max-w-7xl">
        {showBack ? (
          <Link 
            href="/" 
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex justify-center items-center text-temu-black shadow-sm border border-temu-gray-border-light active:scale-90 transition touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </Link>
        ) : (
          <button className="space-y-1.5 p-2 -ml-2 cursor-pointer active:scale-90 transition touch-manipulation">
            <div className="w-6 h-0.5 bg-temu-black rounded-full"></div>
            <div className="w-4 h-0.5 bg-temu-black rounded-full"></div>
          </button>
        )}

        {/* زر السلة في الـ Header */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-temu-offwhite transition-all active:scale-90 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1E3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            {totalItems > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-temu-error text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {totalItems}
              </span>
            )}
          </button>

          {/* نافذة السلة المنسدلة */}
          {isOpen && (
            <div className="absolute right-0 mt-2 bg-white border border-temu-gray-border-light shadow-2xl rounded-temu-sm p-5 w-80 max-h-96 overflow-y-auto scrollbar-hide touch-pan-y z-50">
              <div className="flex justify-between items-center mb-4 border-b border-temu-gray-border-light pb-3">
                <h3 className="text-base font-extrabold text-temu-black">Your Cart</h3>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="text-temu-gray-light hover:text-temu-black font-bold active:scale-90 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-temu-gray-light text-center py-8 font-medium">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-temu-offwhite p-2.5 rounded-temu-sm">
                        <div className="pr-2">
                          {/* ✨ تصحيح: استخدام item.name بدلاً من item.title */}
                          <p className="text-xs font-bold text-temu-black line-clamp-1">{item.name}</p>
                          <p className="text-[10px] text-temu-gray-light">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-xs font-extrabold text-temu-black">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-temu-gray-border-light pt-3">
                    <div className="flex justify-between font-extrabold text-sm mb-4 text-temu-black">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={handleCheckout}
                      className="w-full bg-temu-error text-white py-3 rounded-temu-sm font-bold text-xs shadow-md hover:bg-temu-orange-bright transition-all cursor-pointer active:scale-95 touch-manipulation"
                    >
                      Checkout with Stripe
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}