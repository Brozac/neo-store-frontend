'use client'; 

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from './components/ProductCard';
import LightningDeals from './components/LightningDeals';
import HeroSection from './components/HeroSection';
import ShoppableReels from './components/ShoppableReels';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'discount' | 'newest';
type PriceRangeOption = 'all' | 'under15' | '15to35' | 'above35';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const categoryQuery = searchParams.get('category') || '';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
  
  const [products, setProducts] = useState<any[]>([]);
  const [dealsProducts, setDealsProducts] = useState<any[]>([]);
  const [categoryStructure, setCategoryStructure] = useState<any[]>([{ name: 'All', slug: 'all' }]);
  const [loading, setLoading] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState(categoryQuery || 'All');
  const [visibleCount, setVisibleCount] = useState(20);
  const [activeTrendingId, setActiveTrendingId] = useState<string | null>(null);
  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);
  const [showReels, setShowReels] = useState(true);

  // ✨ حالات الفرز والتصفية الذكية
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [priceRange, setPriceRange] = useState<PriceRangeOption>('all');

  // ✨ جلب البيانات المتوازي الصحيح (يشمل settings لحل مشكلة التكرار اللانهائي)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/products/deals`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/categories`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/settings`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]).then(([productsData, dealsData, categoriesData, settingsData]) => {
      if (Array.isArray(productsData)) {
        setProducts(productsData);
      }
      if (Array.isArray(dealsData)) {
        setDealsProducts(dealsData);
      }
      if (Array.isArray(categoriesData)) {
        const mainCategories = categoriesData.map((cat: any) => ({ name: cat.name, slug: cat.slug }));
        setCategoryStructure([{ name: 'All', slug: 'all' }, ...mainCategories]);
      }
      if (settingsData && (settingsData as any).show_reels === false) {
        setShowReels(false);
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [API_URL]);

  useEffect(() => {
    if (categoryQuery) setActiveCategory(categoryQuery);
    else setActiveCategory('All');
  }, [categoryQuery]);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeCategory, searchQuery, sortBy, priceRange]);

  // ✨ اختيار منتجات الـ Trending (آلات الحلاقة أولاً، مع Fallback ذكي)
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

  // ✨ 1. تصفية الكتالوج (البحث + الأقسام + نطاق السعر)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = q === '' || 
                            product.title?.toLowerCase().includes(q) || 
                            product.description?.toLowerCase().includes(q);
      if (!matchesSearch) return false;

            // فلترة الأقسام مع دعم التصنيفات الفرعية
      let matchesCategory = true;
      if (activeCategory !== 'All') {
        const pCat = (product.category || '').toLowerCase();
        const activeCatObj = categoryStructure.find(c => c.name === activeCategory);
        if (activeCatObj && activeCatObj.slug) {
          const targetSlug = activeCatObj.slug.toLowerCase();
          matchesCategory = pCat === targetSlug || pCat.startsWith(targetSlug + '-') || pCat.startsWith(targetSlug + '/');
        } else {
          // ✨ fallback: الرابط ممكن يكون slug فرعي (مشاركة/ريلز) ماشي فالشريط العلوي
          // نطابقو بالـ raw slug مباشرة بدل ما نخبيو الكتالوغ كامل
          const rawSlug = activeCategory.toLowerCase();
          matchesCategory = pCat === rawSlug || pCat.startsWith(rawSlug + '-') || pCat.startsWith(rawSlug + '/');
        }
      }
      if (!matchesCategory) return false;

      // تصفية السعر المباشرة (Price Range Filter)
      const price = Number(product.price) || 0;
      if (priceRange === 'under15') return price < 15;
      if (priceRange === '15to35') return price >= 15 && price <= 35;
      if (priceRange === 'above35') return price > 35;

      return true;
    });
  }, [products, searchQuery, activeCategory, categoryStructure, priceRange]);

  // ✨ 2. فرز وترتيب المنتجات لحظياً (Sorting Engine)
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];

    if (sortBy === 'price-asc') {
      return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    if (sortBy === 'price-desc') {
      return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }
    if (sortBy === 'discount') {
      return list.sort((a, b) => {
        const discA = Number(a.original_price) > Number(a.price) 
          ? (Number(a.original_price) - Number(a.price)) / Number(a.original_price) 
          : 0;
        const discB = Number(b.original_price) > Number(b.price) 
          ? (Number(b.original_price) - Number(b.price)) / Number(b.original_price) 
          : 0;
        return discB - discA;
      });
    }
    if (sortBy === 'newest') {
      return list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    return list;
  }, [filteredProducts, sortBy]);

  // استبعاد الـ Trending من القائمة السفلية الافتراضية لمنع التكرار
  const displayProducts = useMemo(() => {
    const isDefaultFeed = activeCategory === 'All' && searchQuery === '' && sortBy === 'default' && priceRange === 'all';
    if (!isDefaultFeed) {
      return sortedProducts.slice(0, visibleCount);
    }

    const trendingIdSet = new Set(trendingProducts.map(p => String(p.id)));
    const nonTrending = sortedProducts.filter(p => !trendingIdSet.has(String(p.id)));
    return nonTrending.slice(0, visibleCount);
  }, [sortedProducts, trendingProducts, activeCategory, searchQuery, sortBy, priceRange, visibleCount]);

  const hasActiveFilters = sortBy !== 'default' || priceRange !== 'all';

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans relative pt-4">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* 1. Hero Section */}
        {activeCategory === 'All' && searchQuery === '' && (
          <HeroSection trendingProducts={trendingProducts} />
        )}

        {/* 2. Categories Bar */}
        <div id="catalog" className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide touch-pan-x">
          {categoryStructure.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button 
                key={cat.name}
                onClick={() => {
                  setActiveCategory(cat.name);
                  setPriceRange('all');
                }}
                style={{ clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0% 100%)' }}
                className={`shrink-0 px-7 py-2.5 text-xs uppercase tracking-wider font-extrabold whitespace-nowrap transition-all duration-300 cursor-pointer border active:scale-95 ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] text-white border-transparent shadow-md scale-105' 
                    : 'bg-white text-temu-gray-text border-temu-gray-border-light hover:bg-temu-offwhite'
                }`}
              >
                {cat.name === 'Shavers' ? 'Electric Grooming' : cat.name}
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
        
        {/* 4. Shoppable Reels Feed (تظهر فقط إذا كان خيار showReels مفعلاً) */}
        {activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && showReels && (
          <div className="mb-8 mt-6">
            <ShoppableReels products={products} />
          </div>
        )}

        {/* 5. Trending Now Section */}
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
                const img = product.image_url || product.image || '/icon-512.png';
                // ✨ Tenet #9 — title غير قابل لـ null أبداً
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

        {/* =========================================================================
            🧭 شريط الفرز والفلترة الذكي (Smart Sorting & Price Filter Toolbar)
           ========================================================================= */}
        <div className="bg-white p-4 rounded-2xl border border-temu-gray-border-light shadow-xs mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-temu-black tracking-tight">
                {searchQuery ? `Results for "${searchQuery}"` : (activeCategory === 'All' ? 'Popular Essentials' : activeCategory)}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Showing <strong className="text-temu-black">{displayProducts.length}</strong> of {filteredProducts.length} items
              </p>
            </div>

            {/* قائمة خيارات الترتيب */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Sort By:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-temu-offwhite border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-temu-black focus:outline-none focus:border-[#8B78C6] cursor-pointer w-full sm:w-auto shadow-2xs"
              >
                <option value="default">✨ Top Recommendations</option>
                <option value="price-asc">💵 Price: Low to High</option>
                <option value="price-desc">💎 Price: High to Low</option>
                <option value="discount">🔥 Biggest Discounts (% OFF)</option>
                <option value="newest">⚡ Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* أزرار ميزانيات الأسعار السريعة */}
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
                      ? 'bg-[#1D1E3C] text-white shadow-xs'
                      : 'bg-temu-offwhite hover:bg-gray-100 text-gray-600 border border-gray-200/80'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* زر تصفير الفلاتر */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSortBy('default');
                  setPriceRange('all');
                }}
                className="text-xs text-[#FF6B9D] font-bold hover:underline cursor-pointer active:scale-95 transition whitespace-nowrap"
              >
                Reset Filters ✕
              </button>
            )}
          </div>
        </div>

        {/* 6. شبكة المنتجات (Products Grid) */}
        <div className="mb-4">
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
              {displayProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  isTouched={touchedProductId === String(product.id)} 
                />
              ))}
            </div>
          ) : (
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
          )}

          {/* زر تحميل المزيد */}
          {!loading && displayProducts.length > 0 && filteredProducts.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button 
                type="button"
                onClick={() => setVisibleCount(prev => prev + 20)} 
                className="flex items-center gap-2 bg-linear-to-r from-temu-orange to-temu-orange-bright text-white font-extrabold py-3.5 px-10 rounded-full hover:brightness-110 transition shadow-lg text-xs uppercase tracking-wider cursor-pointer active:scale-95"
              >
                Load More Products ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full px-7 py-3 shadow-xl flex items-center gap-8 z-30 border border-gray-200">
         <button onClick={() => router.push('/profile')} className="text-gray-400 hover:text-temu-orange transition cursor-pointer active:scale-90" title="Account Profile">
           <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </button>
         <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-temu-orange scale-110 cursor-pointer active:scale-90" title="Scroll to Top">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
         </button>
         <button onClick={() => router.push('/categories')} className="text-gray-400 hover:text-temu-orange transition cursor-pointer active:scale-90" title="All Categories">
           <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
         </button>
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