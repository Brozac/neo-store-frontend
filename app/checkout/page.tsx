'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // ✨ جلب التوكن لإرساله مع الطلب (لربط الطلب بحساب الزبون في قاعدة البيانات)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const items = cart.map(item => ({
        id: item.id,
        title: item.name,
        price: Number(item.price),
        image_url: item.image,
        quantity: item.quantity,
        vid: item.vid
      }));

      const response = await fetch('https://neo-store-backend.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers, // ✨ إرسال الـ Headers مع التوكن
        body: JSON.stringify({
          items: items,
          origin: window.location.origin
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to create checkout session.');
        setLoading(false);
      }

    } catch (error) {
      console.error('Checkout Error:', error);
      alert('An error occurred during checkout. Please try again.');
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-6">
        <h1 className="text-2xl font-bold text-temu-black mb-4">Your cart is empty</h1>
        {/* ✨ إضافة active:scale-95 للزر */}
        <button onClick={() => router.push('/')} className="bg-temu-orange text-white px-6 py-3 rounded-temu-sm font-bold cursor-pointer active:scale-95 transition shadow-md">
          Go Shopping
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-md mx-auto">
        {/* ✨ زر الرجوع مع أيقونة وتأثير الضغط */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Cart
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-6">Checkout</h1>

        {/* ملخص الطلب */}
        <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light shadow-sm mb-6">
          <h2 className="font-bold text-temu-black mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm border-b border-temu-gray-border-light pb-2">
                <span className="text-temu-gray-text">
                  {item.name} <br/> 
                  <span className="text-xs text-temu-gray-light">Qty: {item.quantity} {item.color && `(${item.color}, ${item.size})`}</span>
                </span>
                <span className="font-bold text-temu-black">
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-temu-gray-text font-medium">Total to Pay:</span>
            <span className="text-2xl font-bold text-temu-error">${cartTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* قسم الدفع */}
        <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light shadow-sm mb-6">
          <h2 className="font-bold text-temu-black mb-4">Payment Details</h2>
          
          {/* ✨ زر الدفع مع تأثير اللمس (touch-manipulation & active:scale) ومؤشر تحميل */}
          <button 
            onClick={handleCheckout} 
            disabled={loading}
            className="w-full bg-temu-orange text-white font-extrabold p-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex justify-center items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-6 active:scale-95 touch-manipulation shadow-md gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              `Pay $${cartTotal.toFixed(2)} with Stripe`
            )}
          </button>

          {/* شارة الثقة وشعار Stripe */}
          <div className="pt-6 border-t border-temu-gray-border-light">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-temu-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
                <p className="text-sm font-bold text-temu-black">Pay confidently with our secure methods</p>
              </div>
              
              <svg viewBox="0 0 60 25" className="h-6 w-auto" xmlns="http://www.w3.org/2000/svg">
                <path fill="#1D1E3C" d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04.76-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63L34.9 25V6.46h3.72l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.71-6.6 7.71zm-.74-11.2c-.95 0-1.56.34-2 .86v5.05c.4.48 1 .82 2 .82 1.55 0 2.6-1.77 2.6-3.4 0-1.6-.94-3.33-2.6-3.33zM28.24 6.46h3.96l.05 1.12c.33-.43 1.26-1.33 2.95-1.33 2.4 0 4.2 1.55 4.2 5.06V20h-4.2v-8.49c0-1.2-.42-1.66-1.3-1.66-.85 0-1.43.4-1.73.8V20h-4.2V6.46zM20.3 20.3c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04.76-.06 1.48h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1zm-2.74-7.9c0 1.85 1.14 2.58 2.17 2.58 1.01 0 2.08-.73 2.08-2.58h-4.25zM7.2 12.6v-2.6h9.9v2.6H7.2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}