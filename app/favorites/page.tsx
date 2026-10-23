'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../components/ProductCard';
import GlassIcon from '@/components/ui/GlassIcon';

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

      // 🆕 by-ids — غير المفضلة (كان: الكاتالوغ كامل ~26MB كيتفلتر client-side)
      const ids = favs.map((x: any) => parseInt(x, 10))
        .filter((nn: number) => Number.isInteger(nn) && nn > 0).slice(0, 100);
      if (ids.length === 0) { setFavoriteProducts([]); setLoading(false); return; }

      const res = await fetch(`${API_BASE_URL}/api/products/by-ids?ids=${ids.join(',')}`);
      if (!res.ok) {
        setFavoriteProducts([]);
        return;
      }

      const data = await res.json();
      setFavoriteProducts(Array.isArray(data) ? data : []);
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
      <div className="min-h-screen flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-4 border-fog-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-temu-gray-text">Loading saved items...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 pb-32 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex justify-between items-center border-b border-fog-200 pb-4 flex-wrap gap-2">
          <div>
            <button 
              onClick={() => router.push('/profile')} 
              className="flex items-center gap-2 text-temu-gray-text hover:text-fog-600 font-bold text-xs uppercase tracking-wider transition cursor-pointer mb-2 active:scale-95 w-fit"
            >
              &larr; Back to Account
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-temu-black tracking-tight">Saved Wishlist</h1>
          </div>

          <span className="text-xs font-mono font-bold bg-white px-3.5 py-1.5 rounded-full border border-fog-200 shadow-[0_4px_18px_rgba(91,126,166,0.09)] text-fog-600">
            {favoriteProducts.length} Saved {favoriteProducts.length === 1 ? 'Product' : 'Products'}
          </span>
        </div>

        {favoriteProducts.length === 0 ? (
          <div className="bg-white p-12 sm:p-16 rounded-3xl border border-fog-100 text-center shadow-[0_4px_18px_rgba(91,126,166,0.09)] max-w-lg mx-auto space-y-4">
            <div className="w-24 h-24 rounded-full bg-linear-to-br from-fog-200 to-white flex items-center justify-center mx-auto shadow-[0_4px_18px_rgba(91,126,166,0.09)]">
              <GlassIcon ch="❤️" size="md" />
            </div>
            <h2 className="text-lg font-black text-temu-black">Your Wishlist is Empty</h2>
            <p className="text-xs text-temu-gray-text max-w-sm mx-auto leading-relaxed">
              Tap the heart icon on any product card or details page to save trending deals for later.
            </p>
            <div className="pt-2">
              <Link 
                href="/" 
                className="inline-block bg-linear-to-r from-fog-500 to-fog-600 hover:brightness-110 text-white font-extrabold px-8 py-3.5 rounded-full text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-[0_10px_22px_rgba(70,100,138,0.32)]"
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