'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../components/ProductCard';

export default function FavoritesPage() {
  const router = useRouter();
  const [favoriteProducts, setFavoriteProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const fetchFavorites = useCallback(async () => {
    try {
      const favsRaw = localStorage.getItem('favorites');
      const favs: string[] = favsRaw ? JSON.parse(favsRaw) : [];

      if (!Array.isArray(favs) || favs.length === 0) {
        setFavoriteProducts([]);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/products`);
      if (!res.ok) {
        setFavoriteProducts([]);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        const filtered = data.filter((product: any) => favs.includes(String(product.id)));
        setFavoriteProducts(filtered);
      } else {
        setFavoriteProducts([]);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setFavoriteProducts([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchFavorites();

    // ✨ الاستماع للتغييرات اللحظية في المفضلة عبر التبويبات أو عند النقر
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'favorites') {
        fetchFavorites();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchFavorites]);

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-400">Loading saved items...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 pb-32 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4 flex-wrap gap-2">
          <div>
            <button 
              onClick={() => router.push('/profile')} 
              className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer mb-2 active:scale-95 w-fit"
            >
              &larr; Back to Account
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Saved Wishlist</h1>
          </div>

          <span className="text-xs font-mono font-bold bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-sm text-gray-700">
            {favoriteProducts.length} Saved {favoriteProducts.length === 1 ? 'Product' : 'Products'}
          </span>
        </div>

        {favoriteProducts.length === 0 ? (
          <div className="bg-white p-12 sm:p-16 rounded-2xl border border-gray-200 text-center shadow-sm max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 bg-pink-50 text-[#FF6B9D] rounded-full flex items-center justify-center text-3xl mx-auto shadow-sm">
              ❤️
            </div>
            <h2 className="text-lg font-black text-gray-900">Your Wishlist is Empty</h2>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Tap the heart icon on any product card or details page to save trending deals for later.
            </p>
            <div className="pt-2">
              <Link 
                href="/" 
                className="inline-block bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold px-8 py-3.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-md"
              >
                Explore Trending Catalog &rarr;
              </Link>
            </div>
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
                  setTouchedProductId(card.getAttribute('data-product-id'));
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