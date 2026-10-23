'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import GlassIcon from '@/components/ui/GlassIcon';

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

  // 🌍 Geo Flow — علم البلد من كود ISO-2 (الاستجابة فيها geo أصلاً)
  const flagOf = (cc?: string) =>
    cc && /^[A-Z]{2}$/.test(cc)
      ? cc.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)))
      : '🌍';

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

  // 💰 v3.1 — السعر الرسمي من المحرك (سيرفر-side · هامش 35% محمي · floor $9.99)
  const sellPrice = Number(product?.laclarcPrice) || 0;

  // 🔒 FIX-XSS (Task 20) — sanitizeDescription كاينة فعلاً دابا (كان التعليق كاذب!)
  // وصف CJ = HTML من أطراف ثالثة غير موثوقة — كنحوّلو لنص عادي آمن 100%:
  // 1) <br>/</p>/</li>/</div>/</h1-6> → سطر جديد (نحافظو على القراءة)
  // 2) أي وسوم أخرى → مسافة (نفس stripHtml ديال ProductDetailsClient)
  // 3) مسافات متكررة → واحدة
  const sanitizeDescription = (html?: string): string => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  };

  const handleAddToCart = () => {
    if (!product) return;
    // 💰 سعر الـ variant الفعلي من المحرك — متطابق مع اللي غادي يتفلترة
    const v0 = product.variants?.[0] || {};
    const variantPrice = Number(v0.laclarcVariantPrice) || sellPrice;
    addToCart({
      id: pid,
      title: product.title,
      name: product.title,
      price: variantPrice,
      quantity: 1,
      image: mainImg,
      image_url: mainImg,
      vid: v0.vid || '',
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
          <GlassIcon i="arrowLeft" size="xs" /> Back
        </button>

        <div className="bg-fog-50/60 border border-[#6B3DB4]/25 rounded-xl p-3 text-xs font-bold text-[#6B3DB4] text-center">
          <GlassIcon ch="🌍" size="xs" /> Global Catalog Item — ships directly via CJ Dropshipping
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
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${mainImg === img ? 'border-[#6B3DB4]' : 'border-gray-200'}`}>
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
              {/* ✨ Tenet #26 — بلا strikethrough مولّد (قرار 1) */}
            </div>

            {product.shipping?.source === 'cj-live' ? (
              /* 🚚 Geo Flow v3.0 — الثمن المباشر من freightCalculateTip (عرض حقيقي) */
              <div className="bg-white border border-temu-gray-border-light rounded-xl p-3 text-xs font-bold text-temu-gray-text space-y-1">
                <p>
                  <GlassIcon ch="🚚" size="xs" /> Shipping to {flagOf(product.geo?.country)} {product.geo?.name || 'you'}:
                  <span className="text-temu-black"> ${Number(product.shipping.amount).toFixed(2)}</span>
                  {product.shipping.channelName && <span className="text-temu-gray-light font-medium"> · {product.shipping.channelName}</span>}
                </p>
                {product.shipping.arrivalTime && (
                  <p className="text-temu-gray-light font-medium"><GlassIcon ch="⏱️" size="xs" /> Estimated arrival: {product.shipping.arrivalTime} days · live CJ quote</p>
                )}
              </div>
            ) : Number(product.estimatedShipUsd) > 0 ? (
              <div className="bg-white border border-temu-gray-border-light rounded-xl p-3 text-xs font-bold text-temu-gray-text">
                <GlassIcon ch="🚚" size="xs" /> Estimated shipping from ~${Number(product.estimatedShipUsd).toFixed(2)} — ships worldwide via CJ, 7–15 business days
              </div>
            ) : null}

            <button
              onClick={handleAddToCart}
              disabled={added}
              className={`w-full text-white font-black py-4 px-6 rounded-temu-sm transition flex items-center justify-center gap-2 text-base cursor-pointer active:scale-95 shadow-lg ${
                added ? 'bg-emerald-600' : 'bg-temu-orange hover:bg-temu-orange-bright'
              }`}
            >
              {added ? <><span><GlassIcon i="check" size="xs" /></span> Added — Opening Cart…</> : <><span><GlassIcon ch="🛒" size="xs" /></span> Add to Cart</>}
            </button>

            {/* 🔒 XSS-safe (FIX Task 20) — description كتنعرض كنص عادي منقّى
                بـ sanitizeDescription (الدالة كاينة فوق فعلاً دابا) — صفر HTML خام */}
            <div className="border-t border-temu-gray-border-light pt-4 text-sm text-temu-gray-text leading-relaxed whitespace-pre-line">
              {sanitizeDescription(product.description) || 'Full specifications available — contact support for any question.'}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}