'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../components/ProductCard';

export default function FavoritesPage() {
  const router = useRouter();
  const [favoriteProducts, setFavoriteProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✨ إضافة حالة تتبع الإصبع
  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (favs.length === 0) {
          setFavoriteProducts([]);
          setLoading(false);
          return;
        }

        // جلب كل المنتجات ثم فلترة المفضلة
        const res = await fetch('https://neo-store-backend.onrender.com/api/products');
        const data = await res.json();
        
        const filtered = data.filter((product: any) => favs.includes(String(product.id)));
        setFavoriteProducts(filtered);
      } catch (err) {
        console.error('Error fetching favorites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

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
          onClick={() => router.push('/profile')} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Profile
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-6">My Favorites</h1>

        {favoriteProducts.length === 0 ? (
          <div className="bg-white p-10 rounded-temu-sm border border-temu-gray-border-light text-center shadow-sm">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-gray-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <p className="text-temu-black font-semibold mb-2">Your favorites list is empty.</p>
            <p className="text-temu-gray-light text-sm mb-6">Tap the heart icon on products to save them here.</p>
            <Link 
              href="/" 
              className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Discover Products
            </Link>
          </div>
        ) : (
          // ✨ تطبيق تتبع الإصبع على شبكة المفضلة
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
            {favoriteProducts.map((product) => (
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