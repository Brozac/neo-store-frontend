'use client';

import { useCart } from '../context/CartContext';
import { useState } from 'react';
import Link from 'next/link';

export default function Header({ showBack = false }: { showBack?: boolean }) {
  const { cart } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const total = cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
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
          <Link href="/" className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex justify-center items-center text-[#1D1E3C] shadow-sm border border-gray-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </Link>
        ) : (
          <button className="space-y-1.5 p-2 -ml-2 cursor-pointer">
            <div className="w-6 h-0.5 bg-[#1D1E3C] rounded-full"></div>
            <div className="w-4 h-0.5 bg-[#1D1E3C] rounded-full"></div>
          </button>
        )}

        {/* زر السلة في الـ Header (مطابق للتصميم 100%) */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-gray-50 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1E3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            {totalItems > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#E28B93] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {totalItems}
              </span>
            )}
          </button>

          {/* نافذة السلة المنسدلة */}
          {isOpen && (
            <div className="absolute right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-3xl p-5 w-80 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-base font-extrabold text-[#1D1E3C]">Your Cart</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 font-medium">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-2xl">
                        <div className="pr-2">
                          <p className="text-xs font-bold text-[#1D1E3C] line-clamp-1">{item.title}</p>
                          <p className="text-[10px] text-gray-400">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-xs font-extrabold text-[#1D1E3C]">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between font-extrabold text-sm mb-4 text-[#1D1E3C]">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={handleCheckout}
                      className="w-full bg-[#8B78C6] text-white py-3 rounded-2xl font-bold text-xs shadow-md hover:bg-[#7a67b5] transition-all cursor-pointer"
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