'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../../components/ProductCard';

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

export default function CategoryClient() {
  const params = useParams();
  const router = useRouter();

  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/');
  const slug = slugArray[slugArray.length - 1];

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);        // أول صفحة — شاشة كاملة
  const [loadingMore, setLoadingMore] = useState(false); // الصفحات التالية — spinner صغير
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);       // 🛡️ double-fire guard (الـ observer كيطلق جوج مرات على الموبايل)
  // 🆕 v1.2 — totalCount بـ useState (مؤكد العرض الحي — useRef ما كان كيحدّثش الواجهة)
  const [totalCount, setTotalCount] = useState(0);

  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  const categoryName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ✨ Tenet #4 — بلا hardcoded URLs
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ── العدّاد (مستقل وخفيف — للـ header) ──
  // 🆕 v1.2 — useState: العدّاد كيحدّث الواجهة فعلياً عند وصول القيمة
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&count=1`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.count) setTotalCount(d.count); })
      .catch(() => {}); // تجميلي — الصفحة ما تعتمدش عليه، والصمت هنا مقصود وموثق
  }, [slugPath, API_BASE_URL]);

  // ── الصفحة الأولى (AbortController ضد race عند تغيير الفئة) ──
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setProducts([]); setDone(false); setPage(1);

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&page=1`,
          { cache: 'no-store', signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setProducts(arr);
        if (arr.length < PER_PAGE) setDone(true);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error fetching category products:', err);
          setError('Unable to load products right now. Please check your connection.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [slugPath, API_BASE_URL]);

  // ── Infinite scroll — BL-CAT-SCROLL: فئات كبار (3,528+) بلا سقف ──
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || error) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || busy.current) return;
      busy.current = true;
      setLoadingMore(true);
      fetch(`${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&page=${page}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: Product[]) => {
          setProducts(prev => [...prev, ...data]);
          if (!Array.isArray(data) || data.length < PER_PAGE) setDone(true);
          else setPage(p => p + 1);
        })
        .catch(e => console.error('[category-scroll]', e)) // 🩹 Tenet #14: fail of append ≠ blank page — يبقى ما جاب، والمستخدم يعاود
        .finally(() => { busy.current = false; setLoadingMore(false); });
    }, { rootMargin: '600px' }); // تحميل استباقي — بلا spinner محسوس
    io.observe(el);
    return () => io.disconnect();
  }, [page, done, error, slugPath, API_BASE_URL]);

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
          <h1 className="text-3xl font-extrabold text-temu-black capitalize">{categoryName}</h1>
          {totalCount > 0 && (
            <span className="text-xs font-bold text-gray-400">
              {totalCount.toLocaleString()} products
            </span>
          )}
        </div>

        {/* حالة الخطأ منفصلة — ماكتلبسش على "لا يوجد منتجات" */}
        {error && (
          <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <p className="text-temu-black font-semibold mb-2">⚠️ {error}</p>
            <button
              onClick={() => window.location.reload()}
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
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isTouched={touchedProductId === String(product.id)}
                />
              ))}
            </div>

            {/* Sentinel + infinite-scroll states */}
            <div ref={sentinel} className="h-10" />
            {loadingMore && (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}
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