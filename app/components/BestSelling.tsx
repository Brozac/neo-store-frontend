'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IMG } from '@/lib/imageOptimizer';

// ══════════════════════════════════════════════════════════════════
// Best Selling — MERGE_MOCKUP (دمج ذكي — موكاب الصفحة الرئيسية)
//
// صف كروت أفقي بقلب المفضلة فوق الصورة (كيما الموكاب بالضبط):
//      صورة على fog-50 مدوّرة · قلب دائري أبيض فوق يمين · عنوان
//      سطرين · سعر وردي (قرار المالك — coral-600).
//
// 🛡️ المفضلة: نفس مخزن 'favorites' تاع صفحة المنتج والـ favorites
//    page (localStorage — JSON array من string ids) — parse-safe:
//    localStorage فاسد ما يكسرش الصفحة (نفس نمط ProductDetailsClient).
// ══════════════════════════════════════════════════════════════════

interface BSProduct {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  image?: string;
}

function parseFavorites(): string[] {
  try {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    return Array.isArray(favs) ? favs.map(String) : [];
  } catch {
    return []; // localStorage فاسد — نرجعو خاوي (بلا كسر)
  }
}

export default function BestSelling({ products }: { products: BSProduct[] }) {
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // مزامنة أولية + عبر التبويبات (storage event = tabs أخرى)
  useEffect(() => {
    const sync = () => setFavIds(new Set(parseFavorites()));
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const toggleFav = (id: number) => {
    const idStr = String(id);
    const current = parseFavorites();
    const next = current.includes(idStr)
      ? current.filter((f) => f !== idStr)
      : [...current, idStr];
    try {
      localStorage.setItem('favorites', JSON.stringify(next.slice(0, 100)));
    } catch {
      // محظور (private mode) — الحالة المحلية تكفي لهذه الجلسة
    }
    setFavIds((prev) => {
      const s = new Set(prev);
      if (s.has(idStr)) s.delete(idStr);
      else s.add(idStr);
      return s;
    });
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="my-8">
      {/* الرأس — كيما الموكاب: Best Selling + See All */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black text-temu-black">Best Selling</h2>
        <Link
          href="/all-products"
          className="text-xs font-bold text-fog-600 hover:underline cursor-pointer"
        >
          See All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide touch-pan-x pb-2 -mx-4 px-4">
        {products.map((p) => {
          const safePrice = Number(p.price) || 0;
          const img = IMG.card(p.image_url || p.image || '/icon-512.png');
          const isFav = favIds.has(String(p.id));

          return (
            <div key={p.id} className="w-36 sm:w-40 shrink-0 group">
              <div className="relative aspect-square rounded-2xl bg-fog-50 overflow-hidden ring-1 ring-fog-100">
                <Link href={`/products/${p.id}`} aria-label={p.title}>
                  <img
                    src={img}
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>

                {/* قلب المفضلة — كيما الموكاب: دائرة بيضاء فوق يمين */}
                <button
                  type="button"
                  onClick={() => toggleFav(p.id)}
                  aria-label={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={isFav}
                  className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition active:scale-90 cursor-pointer ${
                    isFav
                      ? 'bg-coral-600 text-white shadow-md'
                      : 'bg-white/90 text-temu-black shadow-sm hover:text-coral-600'
                  }`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill={isFav ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
                  </svg>
                </button>
              </div>

              <Link href={`/products/${p.id}`} className="block">
                <h3 className="text-xs font-bold text-temu-black line-clamp-2 mt-2 leading-snug group-hover:text-fog-600 transition">
                  {p.title}
                </h3>
                <div className="text-sm font-black text-coral-600 mt-1">
                  ${safePrice.toFixed(2)}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
