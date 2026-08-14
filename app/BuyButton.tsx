'use client'; 

import { useState } from 'react';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  image?: string;
  image_url?: string;
}

export default function BuyButton({ product }: { product: Product }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // ✨ جلب التوكن لإرساله مع الطلب (لربط الطلب بحساب الزبون)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('https://neo-store-backend.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers, // ✨ إرسال الـ Headers مع التوكن
        body: JSON.stringify({ 
          items: [{
            id: product.id,
            title: product.title,
            price: Number(product.price) || 0,
            image_url: product.image || product.image_url || '',
            quantity: 1
          }],
          origin: window.location.origin
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
      }
    } catch (err) {
      console.error('Server connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout}
      disabled={loading}
      // ✨ إضافة touch-manipulation لإلغاء تأخر النقر (300ms) على الهواتف
      className="w-full bg-temu-error text-white font-extrabold py-4 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition-all transform active:scale-95 touch-manipulation cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
    >
      {loading ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <>Buy Now 🚀</>
      )}
    </button>
  );
}