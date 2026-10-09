'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IMG } from '@/lib/imageOptimizer';

interface P {
  id: number;
  title: string;
  price: number;
  original_price?: number | null;
  image_url: string;
  category: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
const PER_PAGE = 24;

export default function AllProducts() {
  const [items, setItems] = useState<P[]>([]);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // 🛡️ double-fire guard — IntersectionObserver fires twice on mobile

  const loadMore = useCallback(async (p: number) => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/products?page=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: P[] = await res.json();
      setItems((prev) => [...prev, ...data]);
      if (data.length < PER_PAGE) setDone(true);
      else setPage(p + 1);
    } catch (e) {
      console.error('[all-products]', e);
      setRetryable(true); // 🩹 Tenet #14: network failure ≠ silent end — retry button below
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [done]);

  const retry = useCallback(() => {
    setRetryable(false);
    loadMore(page);
  }, [page, loadMore]);

  // first batch
  useEffect(() => {
    loadMore(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // observer — appends one page each time the sentinel enters the viewport
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || retryable) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(page);
      },
      { rootMargin: '600px' } // prefetch before reaching the edge — no visible spinner
    );
    io.observe(el);
    return () => io.disconnect();
  }, [page, done, retryable, loadMore]);
  

  // effect (مرة عند الـ mount):
  useEffect(() => {
    fetch(`${API}/api/products?count=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setTotalCount(d?.count || 0))
      .catch(() => {});
  }, [API]);

  return (
    <main className="min-h-screen bg-temu-offwhite">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-temu-black tracking-tight">🛍️ All Products</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse the full catalog — {items.length}
              {done ? ' products' : '+'}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-[#8B78C6] hover:underline"
          >
            ← Home
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-temu-gray-border-light hover:shadow-lg transition active:scale-[0.98]"
            >
              <div className="relative aspect-square bg-white">
                <Image
                  src={IMG.card(p.image_url)}
                  alt={p.title}
                  fill
                  sizes="(max-width:640px) 50vw, 20vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-temu-black line-clamp-2 leading-tight">
                  {p.title}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-sm font-black text-[#FF6B9D]">
                    ${Number(p.price).toFixed(2)}
                  </span>
                  {Number(p.original_price) > Number(p.price) && (
                    <span className="text-[10px] text-gray-400 line-through">
                      ${Number(p.original_price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Sentinel + states */}
        <div ref={sentinel} className="h-10" />
        {loading && !retryable && (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        {retryable && !done && (
          <div className="text-center py-6">
            <button
              onClick={retry}
              className="text-xs font-bold bg-[#8B78C6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              ↻ Retry
            </button>
          </div>
        )}
        {done && items.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-8">
            🏁 You&apos;ve reached the end — {items.length} products
          </p>
        )}
        {done && items.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-16">
            No products available right now.
          </p>
        )}
      </div>
    </main>
  );
}