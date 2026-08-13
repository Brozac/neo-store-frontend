'use client'; 

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from './components/ProductCard';
import { useCart } from './context/CartContext';


function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const categoryQuery = searchParams.get('category') || '';
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(categoryQuery || 'All');
  const [visibleCount, setVisibleCount] = useState(20);
  
  const [categoryStructure, setCategoryStructure] = useState<any[]>([{ name: 'All', slug: 'all' }]);
  
  const { cart } = useCart();

  useEffect(() => {
    fetch('https://neo-store-backend.onrender.com/api/products') 
      .then((res) => res.json())
      .then((data) => {
        const shuffledData = [...data].sort(() => Math.random() - 0.5);
        setProducts(shuffledData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('https://neo-store-backend.onrender.com/api/categories')
      .then(res => res.json())
      .then(data => {
        const mainCategories = data.map((cat: any) => ({ name: cat.name, slug: cat.slug }));
        setCategoryStructure([{ name: 'All', slug: 'all' }, ...mainCategories]);
      })
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  useEffect(() => {
    if (categoryQuery) {
      setActiveCategory(categoryQuery);
    } else {
      setActiveCategory('All');
    }
  }, [categoryQuery]);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeCategory, searchQuery]);

  const trendingProducts = products.filter(p => 
    p.category?.startsWith('shavers') || 
    p.title?.toLowerCase().includes('shaver') || 
    p.title?.toLowerCase().includes('clipper') ||
    p.title?.toLowerCase().includes('trimmer')
  ).slice(0, 5);
  
  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery === '' || 
                          product.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === 'All') return true;

    const pCat = (product.category || '').toLowerCase().split('/')[0];
    const activeCatObj = categoryStructure.find(c => c.name === activeCategory);
    if (activeCatObj && activeCatObj.slug) {
      return pCat === activeCatObj.slug.toLowerCase();
    }
    
    return false;
  });

  const displayProducts = ((activeCategory === 'All' && searchQuery === '') ? filteredProducts.slice(trendingProducts.length) : filteredProducts).slice(0, visibleCount);

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans relative pt-4">
      
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Categories Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
          {categoryStructure.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button 
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
                className={`shrink-0 px-8 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300 cursor-pointer border active:scale-95 ${
                  isActive 
                    ? 'bg-linear-to-r from-temu-orange to-temu-orange-bright text-white border-transparent shadow-md scale-105' 
                    : 'bg-white text-temu-gray-text border-temu-gray-border-light hover:bg-temu-offwhite'
                }`}
              >
                {cat.name === 'Shavers' ? 'Electric Shaving' : cat.name}
              </button>
            );
          })}
        </div>

        {/* Trending Now Section */}
        {activeCategory === 'All' && searchQuery === '' && trendingProducts.length > 0 && (
          <div className="mb-8 mt-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-extrabold text-temu-black flex items-center gap-2">
                <span className="text-xl">🔥</span> Trending Now
              </h2>
              <span className="text-xs text-temu-orange font-bold cursor-pointer active:scale-95 transition-transform">See All</span>
            </div>
            
            <div className="t-accordion-container">
              {trendingProducts.map((product) => {
                const safePrice = Number(product.price) || 0;
                const img = product.image || product.image_url || '/placeholder.jpg';
                const truncatedTitle = product.title.length > 20 ? product.title.substring(0, 20) + '...' : product.title;
                
                return (
                  <div 
                    key={product.id} 
                    className="t-accordion-card"
                    onClick={() => router.push(`/products/${product.id}`)}
                    tabIndex={0} // ✨ ضروري لكي يتفاعل مع اللمس على الهاتف
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

        {/* Products Grid */}
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-temu-black mb-4">
            {searchQuery ? `Search results for "${searchQuery}"` : (activeCategory === 'All' ? 'Popular Products' : activeCategory)}
          </h2>
          {loading ? (
            <div className="flex justify-center py-10"><p className="text-temu-orange font-bold animate-pulse">Loading...</p></div>
          ) : displayProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-temu-sm border border-temu-gray-border-light">
              <p className="text-temu-gray-light font-medium">No products found. Try a different search or category.</p>
            </div>
          )}

          {/* زر See More */}
          {!loading && displayProducts.length > 0 && filteredProducts.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button 
                onClick={() => setVisibleCount(prev => prev + 20)} 
                className="flex items-center gap-2 bg-temu-orange text-white font-bold py-3 px-10 rounded-full hover:bg-temu-orange-bright transition shadow-md text-sm cursor-pointer active:scale-95"
              >
                See more
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation */}
      {/* ✨ تعديل responsive: padding و gap يتصغرو فالهواتف الصغيرة باش ما يخرجوش برة الشاشة + تأثير اللمس */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full px-8 py-4 shadow-md flex items-center gap-10 z-40 border border-temu-gray-border-light">
         <button onClick={() => router.push('/profile')} className="text-temu-gray-light hover:text-temu-orange transition-colors cursor-pointer active:scale-90">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </button>
         <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-temu-orange scale-110 cursor-pointer active:scale-90">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
         </button>
         <button onClick={() => router.push('/categories')} className="text-temu-gray-light hover:text-temu-orange transition-colors cursor-pointer active:scale-90">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
         </button>
      </div>
    </main>
  );
}



export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-temu-offwhite"><div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div></div>}>
      <HomeContent />
    </Suspense>
  );
}