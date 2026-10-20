'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import GlassIcon from '@/components/ui/GlassIcon';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [geoInfo, setGeoInfo] = useState<{ country: string; name: string; supported: boolean } | null>(null);

  // 🌍 Geo Flow — علم البلد من الاستجابة نفسها (كشف تلقائي بلا أي إعداد)
  const flag = (cc?: string) =>
    cc && /^[A-Z]{2}$/.test(cc)
      ? cc.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)))
      : '🌍';

  useEffect(() => {
    if (!q || q.length < 2) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/cj-live/search?q=${encodeURIComponent(q)}&page=${page}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        const arr = data.products || [];
        setProducts(arr);
        setHasMore(arr.length >= 20);
        if (data.geo?.country) setGeoInfo(data.geo);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [q, page, API_BASE_URL]);

  return (
    <main className="min-h-screen bg-temu-offwhite p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-temu-orange font-bold text-sm"><GlassIcon i="arrowLeft" size="xs" /> Back</Link>
        <h1 className="text-2xl font-black text-temu-black my-4">
          <GlassIcon ch="🌍" size="xs" /> Global Results for: <span className="text-temu-orange">{q}</span>
        </h1>

        {geoInfo?.country && (
          <p className="text-xs font-bold text-temu-gray-text mb-3">
            {flag(geoInfo.country)} Delivering to {geoInfo.name}
            {!geoInfo.supported && ' — worldwide shipping mode'}
          </p>
        )}

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
                    <p className="text-sm font-black text-temu-error">${Number(p.laclarcPrice || p.price).toFixed(2)}</p>
                    {p.ordersCount > 0 && <p className="text-[10px] text-temu-gray-light mt-0.5"><GlassIcon ch="🔥" size="xs" /> {p.ordersCount} sold on CJ</p>}
                  </div>
                </a>
              ))}
            </div>

            {page > 1 && (
              <button onClick={() => setPage(p => Math.max(1, p - 1))} className="mt-6 mr-2 px-4 py-2 rounded-temu-sm border text-xs font-bold">
                <GlassIcon i="arrowLeft" size="xs" /> Previous
              </button>
            )}
            {hasMore && (
            <button onClick={() => setPage(p => p + 1)} className="mt-6 px-4 py-2 rounded-temu-sm border text-xs font-bold">
              Next <GlassIcon i="arrowRight" size="xs" />
            </button>
            )}
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
