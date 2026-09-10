// app/category/[...slug]/CategoryClient.tsx - Client Logic
'use client';

import { useEffect, useState } from 'react';
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

export default function CategoryClient() {
  const params = useParams();
  const router = useRouter();

  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/');
  const slug = slugArray[slugArray.length - 1];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  const categoryName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ✨ Tenet #4 — بلا hardcoded URLs
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ✨ الفلترة فالسيرفر (ILIKE prefix) + AbortController ضد Race Condition
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError('');
    setProducts([]);

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}`,
          { cache: 'no-store', signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error fetching category products:', err);
          setError('Unable to load products right now. Please check your connection.');
        }
      } finally {
        // ✨ منع setState بعد unmount إلا دار abort (نمط آمن 100%)
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [slugPath, API_BASE_URL]);

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

        <h1 className="text-3xl font-extrabold text-temu-black mb-6 capitalize">{categoryName}</h1>

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
        )}
      </div>
    </main>
  );
}