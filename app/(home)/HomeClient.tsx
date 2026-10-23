'use client';

import { useEffect, useState, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '../components/ProductCard';
import LightningDeals from '../components/LightningDeals';
import HeroSection from '../components/HeroSection';
import dynamic from 'next/dynamic';

// 🚀 PERF (Task 20) — Reels تحتها الـ fold = lazy (كيتحمّل غير ملي يوصلو الزائر)
const ShoppableReels = dynamic(() => import('../components/ShoppableReels'), {
  loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-2xl" />,
});
import { IMG } from '@/lib/imageOptimizer';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'discount' | 'newest';
type PriceRangeOption = 'all' | 'under15' | '15to35' | 'above35';

const PER_PAGE = 24;

// ✨ Per-page shuffle: deterministic per (seed, page) — session freshness,
//    stable appends (loaded pages never re-order — Temu-style scroll stability)
function shufflePage(arr: any[], pageNum: number, seed: number | null) {
  if (!seed || arr.length < 2) return arr;
  const list = [...arr];
  let s = (seed + pageNum * 7919) | 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const categoryQuery = searchParams.get('category') || '';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const [dealsProducts, setDealsProducts] = useState<any[]>([]);
  const [categoryStructure, setCategoryStructure] = useState<any[]>([{ name: 'All', slug: 'all' }]);

  const [activeCategory, setActiveCategory] = useState(categoryQuery || 'All');
  const [activeTrendingId, setActiveTrendingId] = useState<string | null>(null);
  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);
  const [showReels, setShowReels] = useState(true);

  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [priceRange, setPriceRange] = useState<PriceRangeOption>('all');

  // ═══ Search branch state (البحث خارج الـ hook — نتائج حتى 200 بلا pagination) ═══
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchGenRef = useRef(0);                 // 🛡️ سباقات البحث السريعة (gen محلي — الـ hook عندو gen ديالو)

  // ✨ Session seed — lazy init (SSR-safe: typeof window guard, Tenet #2)
  const [shuffleSeed] = useState<number | null>(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const saved = sessionStorage.getItem('catalog_seed');
      if (saved) return Number(saved);
      const seed = Math.floor(Math.random() * 1_000_000);
      sessionStorage.setItem('catalog_seed', String(seed));
      return seed;
    } catch {
      return 1;
    }
  });

  const categoriesReady = categoryStructure.length > 1;
  const isBrowsing = !searchQuery; // browse feed vs server search results

  // ═══ v5.1 — الكاتب الوحيد للـ browse feed (Tenet #31) ═══
  // أول صفحة · infinite scroll · dedup · mutex · gen · عدّاد — كلهم في lib/useInfiniteFeed.ts
  // الباغات المكتشفة (تكرار page=1 · observer الميت · السباقات) عالجة مرة وحدة في الكاتب.
  const feed = useInfiniteFeed<any>(
    `${activeCategory}|${categoriesReady}`,
    isBrowsing && (activeCategory === 'All' || categoriesReady),
    {
      buildPageUrl: (page: number) => {
        const slug = categoryStructure.find(c => c.name === activeCategory)?.slug;
        return activeCategory !== 'All'
          ? `${API_URL}/api/products?category=${encodeURIComponent(slug || activeCategory)}&page=${page}`
          : `${API_URL}/api/products?page=${page}`;
      },
      buildCountUrl: () => {
        if (activeCategory !== 'All' && !categoriesReady) return '';   // نستنى slug map (race kill)
        const cat = activeCategory !== 'All'
          ? `&category=${encodeURIComponent(categoryStructure.find(c => c.name === activeCategory)?.slug || activeCategory)}`
          : '';
        return `${API_URL}/api/products?count=1${cat}`;
      },
      perPage: PER_PAGE,
      rootMargin: '800px',                                          // نفس السلوك الاستباقي ديال v5
      shuffle: (arr, pageNum) => shufflePage(arr, pageNum, shuffleSeed),
    }
  );

  // مصدر العرض الموحد — browse من الكاتب الوحيد · search من الفرع المحلي
  const products = isBrowsing ? feed.products : searchResults;
  const loading = isBrowsing ? feed.loading : searchLoading;

  // ── Categories (rail v4) + Deals + Settings — مرة وحدة ──
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/products/deals`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/categories`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/settings`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([dealsData, categoriesData, settingsData]) => {
      if (Array.isArray(dealsData)) setDealsProducts(dealsData);
      if (Array.isArray(categoriesData)) {
        const mainCategories = categoriesData.map((cat: any) => ({ name: cat.name, slug: cat.slug, image_url: cat.image_url }));
        // Rail v4: L1 (بالصور) + L2 (بمسارات slug كاملة) — Temu-style depth
        const allRailCats: any[] = [...(mainCategories || [])];
        const walkRail = (nodes: any[], parentPath: string, depth: number) => (nodes || []).forEach((n: any) => {
          const fullPath = parentPath ? `${parentPath}/${n.slug}` : n.slug;
          if (depth === 1 && n.name && !allRailCats.some((x: any) => x.name === n.name)) {
            allRailCats.push({ name: n.name, slug: fullPath, image_url: n.image_url });
          }
          if (n.children?.length) walkRail(n.children, fullPath, depth + 1);
        });
        walkRail(mainCategories, '', 0);
        setCategoryStructure([{ name: 'All', slug: 'all' }, ...allRailCats]);
      }
      if (settingsData && (settingsData as any).show_reels === false) setShowReels(false);
    });
  }, [API_URL]);

  useEffect(() => {
    setActiveCategory(categoryQuery || 'All');
  }, [categoryQuery]);

  // ═══ البحث — server-side (فرع search الحي — حتى 200 نتيجة) ═══
  // 🩹 v5.1: كيب لـ searchResults (الـ hook مجمد حينما disabled) + gen محلي مستقل
  useEffect(() => {
    if (!searchQuery) return;
    const gen = ++searchGenRef.current;
    const controller = new AbortController();
    setSearchLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/products?search=${encodeURIComponent(searchQuery)}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (gen !== searchGenRef.current) return;
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error('[home-search]', err);
      } finally {
        if (gen === searchGenRef.current) setSearchLoading(false);
      }
    })();

    return () => controller.abort();
  }, [searchQuery, API_URL]);

  // ✨ Trending (آلات الحلاقة أولاً + Fallback)
  const trendingProducts = useMemo(() => {
    if (products.length === 0) return [];
    const shavers = products.filter(p =>
      p.category?.startsWith('shavers') ||
      p.title?.toLowerCase().includes('shaver') ||
      p.title?.toLowerCase().includes('clipper') ||
      p.title?.toLowerCase().includes('trimmer')
    );
    if (shavers.length > 0) return shavers.slice(0, 5);
    return products.slice(0, 5);
  }, [products]);

  // ✨ فلترة client-side المتبقية: price فقط (+ category safety net — السيرفر فلتر أصلاً)
  //    ⚠️ matchesSearch تحيدت: البحث ولّى server-side (والـ SELECT ما فيهش description —
  //    الفلتر client كان كيحذف نتائج صحيحة مطابقة بالوصف — bug صامت مقفول)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      let matchesCategory = true;
      if (activeCategory !== 'All') {
        const pCat = (product.category || '').toLowerCase();
        const activeCatObj = categoryStructure.find(c => c.name === activeCategory);
        const targetSlug = (activeCatObj?.slug || activeCategory).toLowerCase();
        matchesCategory = pCat === targetSlug || pCat.startsWith(targetSlug + '-') || pCat.startsWith(targetSlug + '/');
      }
      if (!matchesCategory) return false;
      const price = Number(product.price) || 0;
      if (priceRange === 'under15') return price < 15;
      if (priceRange === '15to35') return price >= 15 && price <= 35;
      if (priceRange === 'above35') return price > 35;
      return true;
    });
  }, [products, activeCategory, categoryStructure, priceRange]);

  // ✨ Sorting Engine (client — على المحمّل)
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === 'price-asc') return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    if (sortBy === 'price-desc') return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (sortBy === 'discount') {
      return list.sort((a, b) => {
        const discA = Number(a.original_price) > Number(a.price)
          ? (Number(a.original_price) - Number(a.price)) / Number(a.original_price) : 0;
        const discB = Number(b.original_price) > Number(b.price)
          ? (Number(b.original_price) - Number(b.price)) / Number(b.original_price) : 0;
        return discB - discA;
      });
    }
    if (sortBy === 'newest') return list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return list;
  }, [filteredProducts, sortBy]);

  // ✨ العرض: default feed = accumulated (بلا trending) · الفرز = sorted — بلا slice
  const displayProducts = useMemo(() => {
    const isDefaultFeed = activeCategory === 'All' && !searchQuery && sortBy === 'default' && priceRange === 'all';
    if (isDefaultFeed) {
      const trendingIdSet = new Set(trendingProducts.map(p => String(p.id)));
      return products.filter(p => !trendingIdSet.has(String(p.id)));
    }
    return sortedProducts;
  }, [products, sortedProducts, trendingProducts, activeCategory, searchQuery, sortBy, priceRange]);

  const hasActiveFilters = sortBy !== 'default' || priceRange !== 'all';

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans relative pt-4">
      <div className="max-w-7xl mx-auto px-4">

        {/* 1. Hero Section */}
        {activeCategory === 'All' && searchQuery === '' && (
          <HeroSection trendingProducts={trendingProducts} />
        )}

        {/* 2. Categories Bar — Temu-style rail */}
        <div id="catalog" className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide touch-pan-x">
          {categoryStructure.map((cat) => {
            const isActive = activeCategory === cat.name;
            const label = cat.name === 'Shavers' ? 'Electric Grooming' : cat.name;
            const img = cat.image_url ? IMG.thumb(cat.image_url) : null;
            return (
              <button
                key={cat.slug || cat.name}
                onClick={() => {
                  setActiveCategory(cat.name);
                  setPriceRange('all');
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-20 group cursor-pointer active:scale-95 transition touch-manipulation"
              >
                <div className={`relative w-16 h-16 rounded-full overflow-hidden bg-white ring-2 transition-all duration-300
                                 ${isActive ? 'ring-[#5B7EA6] shadow-md' : 'ring-transparent group-hover:ring-[#5B7EA6]/40'}`}>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-[#5B7EA6]/70">
                    {cat.name === 'All' ? '🛍️' : (label?.[0] || '?')}
                  </span>
                  {img && (
                    <img
                      src={img}
                      alt={label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  )}
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight line-clamp-2 transition-colors
                                  ${isActive ? 'text-[#5B7EA6]' : 'text-temu-black'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Lightning Deals */}
        {activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && (
          <div className="mb-6">
            <LightningDeals products={dealsProducts} />
          </div>
        )}

        {/* 4. Shoppable Reels */}
        {activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && showReels && (
          <div className="mb-8 mt-6">
            <ShoppableReels products={products} />
          </div>
        )}

        {/* 5. Trending Now */}
        {activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && trendingProducts.length > 0 && (
          <div className="mb-8 mt-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-black text-temu-black flex items-center gap-2">
                <span>🔥</span> Trending Now
              </h2>
              <span className="text-xs text-temu-orange font-bold cursor-pointer active:scale-95 transition-transform">
                Top Picks
              </span>
            </div>

            <div
              className="t-accordion-container"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.t-accordion-card');
                  if (card) {
                    setActiveTrendingId(card.getAttribute('data-product-id'));
                  } else {
                    setActiveTrendingId(null);
                  }
                }
              }}
              onTouchEnd={() => setActiveTrendingId(null)}
            >
              {trendingProducts.map((product) => {
                const safePrice = Number(product.price) || 0;
                const img = IMG.card(product.image_url || product.image || '/icon-512.png');
                const safeTitle = product.title || 'Laclarc Product';
                const truncatedTitle = safeTitle.length > 22 ? safeTitle.substring(0, 22) + '...' : safeTitle;

                return (
                  <div
                    key={product.id}
                    data-product-id={String(product.id)}
                    className={`t-accordion-card ${activeTrendingId === String(product.id) ? 'is-touched' : ''}`}
                    onClick={() => router.push(`/products/${product.id}`)}
                    tabIndex={0}
                  >
                    <img src={img} alt={safeTitle} />
                    <div className="t-accordion-head">
                      {truncatedTitle}
                      <span className="acc-price">${safePrice.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🧭 شريط الفرز والفلترة */}
        <div className="bg-white p-4 rounded-2xl border border-temu-gray-border-light shadow-xs mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-temu-black tracking-tight">
                {searchQuery ? `Results for "${searchQuery}"` : (activeCategory === 'All' ? 'Popular Essentials' : activeCategory)}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Showing <strong className="text-temu-black">{displayProducts.length}</strong> of{' '}
                {(isBrowsing && feed.totalCount) ? feed.totalCount.toLocaleString() : filteredProducts.length} items
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-temu-offwhite border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-temu-black focus:outline-none focus:border-[#5B7EA6] cursor-pointer w-full sm:w-auto shadow-2xs"
              >
                <option value="default">✨ Top Recommendations</option>
                <option value="price-asc">💵 Price: Low to High</option>
                <option value="price-desc">💎 Price: High to Low</option>
                <option value="discount">🔥 Biggest Discounts (% OFF)</option>
                <option value="newest">⚡ Newest Arrivals</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mr-1 hidden sm:inline">
                Budget:
              </span>
              {[
                { id: 'all', label: 'All Prices' },
                { id: 'under15', label: 'Under $15' },
                { id: '15to35', label: '$15 – $35' },
                { id: 'above35', label: '$35+' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setPriceRange(pill.id as PriceRangeOption)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-95 ${
                    priceRange === pill.id
                      ? 'bg-[#22364A] text-white shadow-xs'
                      : 'bg-temu-offwhite hover:bg-gray-100 text-gray-600 border border-gray-200/80'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSortBy('default');
                  setPriceRange('all');
                }}
                className="text-xs text-[#E2836B] font-bold hover:underline cursor-pointer active:scale-95 transition whitespace-nowrap"
              >
                Reset Filters ✕
              </button>
            )}
          </div>
        </div>

        {/* 6. شبكة المنتجات */}
        <div className="mb-4">
          {/* 🩹 v5.1 — خطأ أول الصفحة (قاتل) — retry داخلي بلا reload */}
          {!loading && feed.error && (
            <div className="bg-white p-8 rounded-2xl border border-temu-gray-border-light shadow-xs text-center mb-4 space-y-3">
              <p className="text-temu-black font-bold text-sm">⚠️ {feed.error}</p>
              <button
                type="button"
                onClick={feed.retry}
                className="bg-temu-orange hover:bg-temu-orange-bright text-white px-5 py-2.5 rounded-full font-bold text-xs transition active:scale-95 shadow-md"
              >
                Try Again
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : displayProducts.length > 0 ? (
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.product-card-wrapper');
                  if (card) {
                    setTouchedProductId(card.getAttribute('data-product-id'));
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
          ) : !feed.error ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-temu-gray-border-light shadow-sm space-y-3">
              <span className="text-3xl">🔍</span>
              <p className="text-temu-gray-text font-bold text-sm">No products found matching these filters.</p>
              <p className="text-xs text-gray-400">Try adjusting your price range or sorting criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setSortBy('default');
                  setPriceRange('all');
                  setActiveCategory('All');
                  router.push('/');
                }}
                className="bg-temu-orange hover:bg-temu-orange-bright text-white px-5 py-2.5 rounded-full font-bold text-xs transition active:scale-95 shadow-md"
              >
                Clear All Filters
              </button>
            </div>
          ) : null}

          {/* 🎯 Sentinel — Temu-style infinite feed (بدل زر Load More) */}
          <div ref={feed.sentinelRef} className="h-10" />
          {feed.loadingMore && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-[#5B7EA6] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
          {isBrowsing && feed.done && !loading && products.length > 0 && (
            <p className="text-center text-xs text-gray-400 py-8">
              🏁 You&apos;ve reached the end — {displayProducts.length.toLocaleString()} products
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-temu-offwhite">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}