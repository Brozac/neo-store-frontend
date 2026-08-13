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
      const res = await fetch('https://neo-store-backend.onrender.com/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      // ✨ استخدام لون Temu الأحمر البرتقالي للزر
      className="w-full bg-temu-error text-white font-extrabold py-4 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition-all transform active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <>Buy Now 🚀</>
      )}
    </button>
  );
}