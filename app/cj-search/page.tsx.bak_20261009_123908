'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!q || q.length < 2) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/cj-live/search?q=${encodeURIComponent(q)}&page=${page}`)
      .then(r => r.json())
      .then(data => { setProducts(data.products || []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [q, page, API_BASE_URL]);

  return (
    <main className="min-h-screen bg-temu-offwhite p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-temu-orange font-bold text-sm">← Back</Link>
        <h1 className="text-2xl font-black text-temu-black my-4">
          🌍 Global Results for: <span className="text-temu-orange">{q}</span>
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center py-16 text-temu-gray-text">No global results for this query.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(p => (
                <a key={p.pid} href={`/cj-product/${p.pid}`}
                   className="bg-white rounded-temu-sm overflow-hidden border border-temu-gray-border-light hover:shadow-md transition group">
                  <div className="aspect-square bg-temu-offwhite overflow-hidden">
                    <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-contain p-2 group-hover:scale-105 transition" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-1">{p.title}</h3>
                    <p className="text-sm font-black text-temu-error">${p.price.toFixed(2)}</p>
                    {p.ordersCount > 0 && <p className="text-[10px] text-temu-gray-light mt-0.5">🔥 {p.ordersCount} sold on CJ</p>}
                  </div>
                </a>
              ))}
            </div>

            {page > 1 && (
              <button onClick={() => setPage(p => Math.max(1, p - 1))} className="mt-6 mr-2 px-4 py-2 rounded-temu-sm border text-xs font-bold">
                ← Previous
              </button>
            )}
            <button onClick={() => setPage(p => p + 1)} className="mt-6 px-4 py-2 rounded-temu-sm border text-xs font-bold">
              Next →
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CjSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-temu-orange border-t-transparent rounded-full" /></div>}>
      <SearchContent />
    </Suspense>
  );
}
