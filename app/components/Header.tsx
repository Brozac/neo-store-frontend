'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

export default function Header({ showBack = false }: { showBack?: boolean }) {
  const router = useRouter();
  const { cart, finalTotal, cartTotal, totalItemsCount, isMounted } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
  const effectiveTotal = finalTotal > 0 ? finalTotal : cartTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoadingCheckout(true);
    setCheckoutError('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // تجهيز البيانات وفق المعيار المحصن في السيرفر
      const formattedItems = cart.map(item => ({
        id: item.id,
        title: item.displayTitle || item.title || item.name || 'Product',
        price: Number(item.price),
        image_url: item.displayImage || item.image_url || item.image || '',
        quantity: item.quantity,
        vid: item.vid || null
      }));

      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          items: formattedItems,
          origin: window.location.origin
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize checkout session.');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      setCheckoutError(error.message || 'Payment initiation failed. Please try again.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <header className="relative w-full z-40">
      <div className="flex justify-between items-center px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        
        {/* Navigation Button */}
        {showBack ? (
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex justify-center items-center text-[#1D1E3C] shadow-sm border border-gray-200 active:scale-90 transition cursor-pointer"
            aria-label="Go Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        ) : (
          <button 
            onClick={() => router.push('/categories')}
            className="space-y-1.5 p-2 rounded-xl hover:bg-black/5 cursor-pointer active:scale-90 transition"
            aria-label="Browse Categories"
            title="Browse All Categories"
          >
            <div className="w-5 h-0.5 bg-[#1D1E3C] rounded-full"></div>
            <div className="w-3.5 h-0.5 bg-[#8B78C6] rounded-full"></div>
          </button>
        )}

        {/* Brand Logo in Header */}
        <Link href="/" className="text-xl font-black tracking-wider text-[#1D1E3C] hover:opacity-90 transition">
          Laclarc
        </Link>

        {/* Cart Popover */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-gray-50 border border-gray-100 transition active:scale-90"
            aria-label="Toggle Cart Drawer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D1E3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>

            {isMounted && totalItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B9D] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {totalItemsCount > 99 ? '99+' : totalItemsCount}
              </span>
            )}
          </button>

          {/* Dropdown Drawer */}
          {isOpen && (
            <div className="absolute right-0 mt-3 bg-white border border-gray-100 shadow-2xl rounded-2xl p-5 w-80 max-h-[420px] overflow-y-auto scrollbar-hide z-50 animate-scale">
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <h3 className="text-xs font-black text-[#1D1E3C] uppercase tracking-wider">
                  Shopping Bag ({isMounted ? totalItemsCount : 0})
                </h3>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="text-gray-400 hover:text-black font-bold p-1 text-xs"
                >
                  ✕
                </button>
              </div>

              {checkoutError && (
                <div className="bg-red-50 text-red-600 text-[11px] p-2 rounded-lg font-bold mb-3">
                  ⚠️ {checkoutError}
                </div>
              )}

              {cart.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <span className="text-2xl">🛒</span>
                  <p className="text-xs text-gray-400 font-medium">Your shopping cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 mb-4 max-h-52 overflow-y-auto pr-1">
                    {cart.map((item: any, index: number) => {
                      const itemTitle = item.displayTitle || item.title || item.name || 'Product';
                      const itemImg = item.displayImage || item.image_url || item.image || '/placeholder.jpg';

                      return (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl gap-2.5">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-gray-200">
                            <Image src={itemImg} alt={itemTitle} fill sizes="40px" className="object-contain p-0.5" />
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-1">
                            <p className="text-xs font-bold text-gray-900 truncate">{itemTitle}</p>
                            <p className="text-[10px] text-gray-500 font-medium">Qty: {item.quantity}</p>
                          </div>
                          <span className="text-xs font-black text-[#FF6B9D] shrink-0">
                            ${(Number(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-bold text-gray-500">Order Subtotal:</span>
                      <span className="text-base font-black text-[#FF6B9D]">${effectiveTotal.toFixed(2)}</span>
                    </div>

                    <button 
                      onClick={handleCheckout}
                      disabled={loadingCheckout}
                      className="w-full bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md transition cursor-pointer active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loadingCheckout ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Checkout with Stripe'
                      )}
                    </button>
                    
                    <button 
                      onClick={() => { setIsOpen(false); router.push('/cart'); }}
                      className="w-full text-center text-[11px] font-bold text-gray-500 hover:text-black hover:underline cursor-pointer"
                    >
                      View Full Bag & All Gateways &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}