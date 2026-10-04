'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';

interface CjVariant {
  vid: string;
  variantKey?: string;
  variantSellPrice?: string | number;
}

export default function CjProductPage() {
  const { pid } = useParams() as { pid: string };
  const router = useRouter();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [mainImg, setMainImg] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/cj-live/product/${pid}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Not found')))
      .then(data => {
        setProduct(data);
        setMainImg(data.bigImage || data.images?.[0] || '');
        setLoading(false);
      })
      .catch(() => { setError('Product not available'); setLoading(false); });
  }, [pid, API_BASE_URL]);

  const sellPrice = Number(product?.sellPrice) || 0;
  const sellOriginal = sellPrice * 1.5;

  const handleAddToCart = () => {
    if (!product) return;
    const firstVid = product.variants?.[0]?.vid || '';
    addToCart({
      id: pid,
      title: product.title,
      name: product.title,
      price: sellPrice,
      quantity: 1,
      image: mainImg,
      image_url: mainImg,
      vid: firstVid,
      live_pid: pid,    // 🩹 M#25 — العلامة الحاسمة: منتج CJ حي
    }, 1);
    setAdded(true);
    setTimeout(() => { router.push('/cart'); }, 800);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-temu-offwhite flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-temu-black font-bold mb-4">{error || 'Product not available'}</p>
          <button onClick={() => router.back()} className="text-temu-orange font-bold text-sm underline">Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
        <button onClick={() => router.back()} className="text-temu-gray-light hover:text-temu-black font-medium text-sm">
          ← Back
        </button>

        <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-xl p-3 text-xs font-bold text-[#8B78C6] text-center">
          🌍 Global Catalog Item — ships directly via CJ Dropshipping
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white border border-temu-gray-border-light shadow-sm">
              <img src={mainImg} alt={product.title} className="w-full h-full object-contain p-4" />
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {(product.images as string[]).map((img: string, i: number) => (
                  <button key={i} onClick={() => setMainImg(img)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${mainImg === img ? 'border-[#8B78C6]' : 'border-gray-200'}`}>
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <h1 className="text-2xl font-black text-temu-black">{product.title}</h1>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-temu-error">${sellPrice.toFixed(2)}</span>
              <span className="text-lg text-temu-gray-light line-through">${sellOriginal.toFixed(2)}</span>
            </div>

            <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-xl p-3 text-xs font-bold text-[#8B78C6]">
              ✓ Ships worldwide via CJ — 7 to 15 business days
            </div>

            <button
              onClick={handleAddToCart}
              disabled={added}
              className={`w-full text-white font-black py-4 px-6 rounded-temu-sm transition flex items-center justify-center gap-2 text-base cursor-pointer active:scale-95 shadow-lg ${
                added ? 'bg-emerald-600' : 'bg-temu-orange hover:bg-temu-orange-bright'
              }`}
            >
              {added ? <><span>✓</span> Added — Opening Cart…</> : <><span>🛒</span> Add to Cart</>}
            </button>

            <div className="border-t border-temu-gray-border-light pt-4 text-sm text-temu-gray-text leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: product.description || '' }} />
          </div>
        </div>
      </div>
    </main>
  );
}
