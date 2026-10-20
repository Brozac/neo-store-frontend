'use client';

import { useState } from 'react';
import { createCheckoutSession } from '../../lib/checkout';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { getStoredUtm } from '../components/UtmTracker';
import GlassIcon from '@/components/ui/GlassIcon';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, finalTotal, wheelDiscount, isMounted } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const utmData = getStoredUtm();

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');

    try {
      // تجهيز العناصر بدقة متوافقة مع دالة prepareSecureItems في السيرفر
      const items = cart.map(item => ({
        id: item.id,
        title: item.displayTitle || item.title || item.name || 'Product',
        price: Number(item.price),
        image_url: item.displayImage || item.image_url || item.image || '',
        quantity: item.quantity,
        vid: item.vid || null
      }));

      const url = await createCheckoutSession(
        items,
        {
          token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
          wheelDiscount: wheelDiscount || 0,
          utm: utmData,
        }
      );

      if (!url) throw new Error('No checkout URL returned from payment server.');
      window.location.href = url;
      // 🔒 no finally — success keeps button locked until redirect
    } catch (err: any) {
      console.error('Checkout Error:', err);
      setError(err.message || 'An error occurred during checkout. Please try again.');
      setLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-6 text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-2xl">
          <GlassIcon ch="🛒" size="xs" />
        </div>
        <h1 className="text-2xl font-extrabold text-temu-black mb-2">Your Cart is Empty</h1>
        <p className="text-temu-gray-light text-sm mb-6">Discover trending deals with worldwide shipping</p>
        <button 
          onClick={() => router.push('/')} 
          className="bg-temu-orange hover:bg-temu-orange-bright text-white px-8 py-3.5 rounded-temu-sm font-extrabold cursor-pointer active:scale-95 transition shadow-md"
        >
          Explore Trending Deals
        </button>
      </div>
    );
  }

  const payableTotal = finalTotal > 0 ? finalTotal : cartTotal;

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-md mx-auto">
        
        {/* Navigation */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition w-fit text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Shopping Cart
        </button>
        
        <h1 className="text-2xl font-black text-temu-black mb-6">Secure Checkout</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-temu-error p-4 rounded-temu-sm mb-6 text-sm font-medium">
            <GlassIcon ch="⚠️" size="xs" /> {error}
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light shadow-sm mb-6 space-y-4">
          <h2 className="font-extrabold text-temu-black text-base border-b border-temu-gray-border-light pb-3">
            Order Review ({cart.reduce((c, i) => c + i.quantity, 0)} items)
          </h2>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <img 
                    src={item.displayImage || item.image_url || item.image || '/placeholder.jpg'} 
                    alt={item.displayTitle || item.name || 'Product'} 
                    className="w-10 h-10 rounded object-cover bg-gray-100 shrink-0" 
                  />
                  <div className="truncate">
                    <p className="font-bold text-temu-black truncate text-xs">
                      {item.displayTitle || item.name}
                    </p>
                    <p className="text-[11px] text-temu-gray-light">
                      Qty: {item.quantity} {item.color && `&bull; ${item.color}`} {item.size && `&bull; ${item.size}`}
                    </p>
                  </div>
                </div>
                <span className="font-black text-temu-black text-sm shrink-0">
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-1.5 text-xs text-temu-gray-text">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-bold text-temu-black">${cartTotal.toFixed(2)}</span>
            </div>

            {wheelDiscount > 0 && (
              <div className="flex justify-between text-temu-green font-bold">
                <span>Lucky Spin Discount ({wheelDiscount}%):</span>
                <span>-${((cartTotal * wheelDiscount) / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Worldwide Shipping:</span>
              <span className="text-temu-green font-bold uppercase">Free Worldwide</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-temu-gray-border-light text-base">
              <span className="font-extrabold text-temu-black">Total to Pay:</span>
              <span className="text-2xl font-black text-temu-error">${payableTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Execution */}
        <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light shadow-sm">
          <button 
            onClick={handleCheckout} 
            disabled={loading}
            className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold p-4 rounded-temu-sm transition flex justify-center items-center cursor-pointer disabled:opacity-50 active:scale-95 shadow-lg gap-2 text-base"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              `Proceed to Stripe Checkout ($${payableTotal.toFixed(2)})`
            )}
          </button>

          <div className="pt-6 mt-6 border-t border-temu-gray-border-light text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-temu-green text-xs font-bold">
              <span><GlassIcon ch="🔒" size="xs" /></span>
              <span>256-Bit Bank-Grade Encrypted Transaction</span>
            </div>
            <p className="text-[11px] text-temu-gray-light leading-relaxed">
              Orders are backed by our 100% Satisfaction Guarantee and dispatched automatically via official CJ Dropshipping logistics.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}