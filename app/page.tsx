'use client'; 

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from './components/ProductCard';
import LightningDeals from './components/LightningDeals';
import HeroSection from './components/HeroSection';
import ShoppableReels from './components/ShoppableReels';

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

  // ✨ جلب البيانات المتوازي (Parallel Data Fetching) لسرعة تحميل فائقة
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/products/deals`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/categories`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
    ]).then(([productsData, dealsData, categoriesData]) => {
      if (Array.isArray(productsData)) {
        // ✨ خلط المنتجات عشوائياً في كل مرة يفتح فيها الزبون الصفحة
        const shuffledData = [...productsData].sort(() => Math.random() - 0.5);
        setProducts(shuffledData);
      }
      if (Array.isArray(dealsData)) {
        setDealsProducts(dealsData);
      }
      if (Array.isArray(categoriesData)) {
        const mainCategories = categoriesData.map((cat: any) => ({ name: cat.name, slug: cat.slug }));
        setCategoryStructure([{ name: 'All', slug: 'all' }, ...mainCategories]);
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
  }, [activeCategory, searchQuery]);

  // ✨ اختيار منتجات الـ Trending (آلات الحلاقة أولاً، مع Fallback ذكي)
  const trendingProducts = useMemo(() => {
    if (products.length === 0) return [];

    // 1. البحث عن آلات الحلاقة في الفئة أو العنوان
    const shavers = products.filter(p => 
      p.category?.startsWith('shavers') || 
      p.title?.toLowerCase().includes('shaver') || 
      p.title?.toLowerCase().includes('clipper') ||
      p.title?.toLowerCase().includes('trimmer')
    );

    // 2. إذا وجدنا آلات حلاقة، نعرضها (بحد أقصى 5)
    if (shavers.length > 0) {
      return shavers.slice(0, 5);
    }

    // 3. إذا لم نجد (Fallback)، نعرض أول 5 منتجات متوفرة لكي لا يختفي القسم
    return products.slice(0, 5);
  }, [products]);

  // ✨ حل مشكلة الأقسام الفرعية (Prefix Matching)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = q === '' || 
                            product.title?.toLowerCase().includes(q) || 
                            product.description?.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (activeCategory === 'All') return true;

      const pCat = (product.category || '').toLowerCase();
      const activeCatObj = categoryStructure.find(c => c.name === activeCategory);
      
      if (activeCatObj && activeCatObj.slug) {
        const targetSlug = activeCatObj.slug.toLowerCase();
        return pCat === targetSlug || pCat.startsWith(targetSlug + '-') || pCat.startsWith(targetSlug + '/');
      }
      
      return false;
    });
  }, [products, searchQuery, activeCategory, categoryStructure]);

  // ✨ حل ثغرة التكرار: استبعاد المعرفات الحقيقية للـ Trending بدلاً من الحذف العشوائي
  const displayProducts = useMemo(() => {
    const isDefaultFeed = activeCategory === 'All' && searchQuery === '';
    if (!isDefaultFeed) {
      return filteredProducts.slice(0, visibleCount);
    }

    const trendingIdSet = new Set(trendingProducts.map(p => String(p.id)));
    const nonTrending = filteredProducts.filter(p => !trendingIdSet.has(String(p.id)));
    return nonTrending.slice(0, visibleCount);
  }, [filteredProducts, trendingProducts, activeCategory, searchQuery, visibleCount]);

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans relative pt-4">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* ✨ 1. راية المتجر الفاخرة (Hero Section) في الصفحة الأولى */}
        {activeCategory === 'All' && searchQuery === '' && (
          <HeroSection trendingProducts={trendingProducts} />
        )}

        {/* Categories Bar */}
        <div id="catalog" className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide touch-pan-x">
          {categoryStructure.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button 
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
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

        {/* ✨ 2. قسم العروض الكهربائية (Lightning Deals) */}
        {activeCategory === 'All' && searchQuery === '' && (
          <div className="mb-6">
            <LightningDeals products={dealsProducts} />
          </div>
        )}
        
        {/* ✨ قسم فيديوهات تيك توك التفاعلية للشراء الفوري */}
        {activeCategory === 'All' && searchQuery === '' && (
          <ShoppableReels products={products} />
        )}
        {/* ✨ 2.5 قسم الريلز القابلة للتسوق (Watch & Shop Reels) */}
        {activeCategory === 'All' && searchQuery === '' && (
          <div className="mb-8 mt-8">
            <ShoppableReels products={products} />
          </div>
        )}

        {/* 3. Trending Now Section */}
        {activeCategory === 'All' && searchQuery === '' && trendingProducts.length > 0 && (
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
                    const id = card.getAttribute('data-product-id');
                    setActiveTrendingId(id);
                  } else {
                    setActiveTrendingId(null);
                  }
                }
              }}
              onTouchEnd={() => setActiveTrendingId(null)}
            >
              {trendingProducts.map((product) => {
                const safePrice = Number(product.price) || 0;
                const img = product.image_url || product.image || '/placeholder.jpg';
                const truncatedTitle = product.title.length > 22 ? product.title.substring(0, 22) + '...' : product.title;
                
                return (
                  <div 
                    key={product.id} 
                    data-product-id={String(product.id)}
                    className={`t-accordion-card ${activeTrendingId === String(product.id) ? 'is-touched' : ''}`}
                    onClick={() => router.push(`/products/${product.id}`)}
                    tabIndex={0}
                  >
                    <img src={img} alt={product.title} />
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

        {/* 4. Products Grid */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-temu-black">
              {searchQuery ? `Search results for "${searchQuery}"` : (activeCategory === 'All' ? 'Popular Essentials' : activeCategory)}
            </h2>
            <span className="text-xs text-gray-500 font-bold">
              Showing {displayProducts.length} of {filteredProducts.length}
            </span>
          </div>

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
                    const id = card.getAttribute('data-product-id');
                    setTouchedProductId(id);
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
            <div className="text-center py-16 bg-white rounded-temu-sm border border-temu-gray-border-light shadow-sm">
              <p className="text-temu-gray-light font-bold text-sm">No items found matching this filter.</p>
              <button 
                onClick={() => { setActiveCategory('All'); router.push('/'); }} 
                className="mt-3 text-xs bg-temu-orange text-white px-4 py-2 rounded-full font-bold"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Load More Button */}
          {!loading && displayProducts.length > 0 && filteredProducts.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button 
                onClick={() => setVisibleCount(prev => prev + 20)} 
                className="flex items-center gap-2 bg-gradient-to-r from-temu-orange to-temu-orange-bright text-white font-extrabold py-3.5 px-10 rounded-full hover:brightness-110 transition shadow-lg text-xs uppercase tracking-wider cursor-pointer active:scale-95"
              >
                Load More Products ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full px-7 py-3 shadow-xl flex items-center gap-8 z-40 border border-gray-200">
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