'use client';

// ═══════════════════════════════════════════════════════════════════
// CategoryClient v2.0 — مهاجر للكاتب الوحيد (Tenet #31)
// ═══════════════════════════════════════════════════════════════════
// كل منطق الـ feed (أول صفحة · observer · Load More · dedup · mutex · gen
// · عدّاد · retry) عايش في lib/useInfiniteFeed.ts — هنا غير التوصيل والعرض.
//
// الباغات اللي عالجها الـ hook بلا مكان لهذا الملف:
//   🩹 تكرار page=1 عند أول scroll/click (نفس باغ الهوم — setPage(2))
//   🩹 FIX-DEAD: الـ observer ميت على cold load (loading خارج الـ deps)
//      — التشخيص الحقيقي ديال "حساس على بعض المتصفحات" تاع M#58
//   🛡️ سباق الزر/observer (حراس منفصلين → mutex واحد)
//   🛡️ تلوث cross-category (genRef في كل المسارات)
//   🩹 الخطأ اليتيم (نجاح loadMore كيمسح error) + الخطأ غير القاتل ولّى
//      inline (moreError) — ماكيمسحش الـ grid
//   🩹 retry داخلي — window.location.reload مات (لا مسح للجلسة والسكرول)
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../../components/ProductCard';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  image: string;
  image_url?: string;
  category?: string;
  [key: string]: any;
}

const PER_PAGE = 24;

// ✨ Task 21-e: h1Text كيجي من القاعدة (seo_h1) عبر الـ Server Wrapper — fallback: categoryName
export default function CategoryClient({ h1Text }: { h1Text?: string | null }) {
  const params = useParams();
  const router = useRouter();

  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/');
  const slug = slugArray[slugArray.length - 1];

  const categoryName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ✨ Tenet #4 — بلا hardcoded URLs
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ═══ الكاتب الوحيد — التوصيل فقط ═══
  const feed = useInfiniteFeed<Product>(slugPath, true, {
    buildPageUrl: (page) =>
      `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&page=${page}`,
    buildCountUrl: () =>
      `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&count=1`,
    perPage: PER_PAGE,
  });

  const {
    products,
    loading,
    loadingMore,
    error,
    moreError,
    done,
    totalCount,
    sentinelRef,
    loadMore,
    retry,
  } = feed;

  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/categories')}
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          All Categories
        </button>

        <div className="flex items-baseline justify-between gap-3 mb-6 flex-wrap">
          <h1 className="text-3xl font-extrabold text-temu-black capitalize">{h1Text || categoryName}</h1>
          {totalCount > 0 && (
            <span className="text-xs font-bold text-gray-400">
              {totalCount.toLocaleString()} products
            </span>
          )}
        </div>

        {/* حالة الخطأ القاتل منفصلة — retry داخلي (بلا reload — الجلسة والسكرول كيبقاو) */}
        {error && (
          <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <p className="text-temu-black font-semibold mb-2">⚠️ {error}</p>
            <button
              onClick={retry}
              className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && products.length === 0 ? (
          <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-gray-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <p className="text-temu-black font-semibold mb-2">No products found in this category yet.</p>
            <p className="text-temu-gray-light text-sm mb-6">We are adding new items daily. Check back soon!</p>
            <Link
              href="/"
              className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.product-card-wrapper');
                  if (card) {
                    const id = card.getAttribute('data-product-id');
                    setTouchedProductId(id);
                  } else {
                    setTouchedProductId(null);
                  }
                }
              }}
              onTouchEnd={() => setTouchedProductId(null)}
            >
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} eager={i < 4} />
              ))}
            </div>

            {/* Sentinel (infinite scroll) — الـ observer كيتصاوب فعلاً (FIX-DEAD مغروز في الـ hook) */}
            <div ref={sentinelRef} className="h-10" />

            {loadingMore && (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* 🩹 v2.0 — moreError غير قاتل: inline — الـ grid كيبقى كامل والزر هو الـ retry */}
            {moreError && products.length > 0 && !loadingMore && (
              <p className="text-center text-xs font-bold text-temu-black pb-2">
                ⚠️ {moreError} Press Load More to retry.
              </p>
            )}

            {/* Load More صريح — dual mode (observer تلقائي + زر مضمون 100%) */}
            {!done && !loadingMore && products.length > 0 && (
              <div className="flex justify-center py-6">
                <button
                  onClick={loadMore}
                  className="bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-3.5 px-10 rounded-temu-sm transition cursor-pointer active:scale-95 shadow-md text-sm gap-2 flex items-center touch-manipulation"
                >
                  Load More ({products.length} / {totalCount > 0 ? totalCount.toLocaleString() : '∞'})
                </button>
              </div>
            )}

            {/* End state */}
            {done && products.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-8">
                🏁 {totalCount > 0
                  ? `${totalCount.toLocaleString()} products in this category`
                  : `${products.length} products`}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}