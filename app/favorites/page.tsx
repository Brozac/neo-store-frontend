'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '../components/ProductCard';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  image: string;
  image_url?: string;
  [key: string]: any;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        // 1. جلب قائمة المفضلة من localStorage
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        if (favorites.length === 0) {
          setLoading(false);
          return;
        }

        // 2. جلب كل المنتجات من السيرفر
        const res = await fetch('https://neo-store-backend.onrender.com/api/products');
        const data: Product[] = await res.json();
        
        // 3. فلترة المنتجات لنجلب فقط تلك الموجودة في المفضلة
        const filtered = data
          .filter((p: Product) => favorites.includes(String(p.id)))
          .map((p: Product) => ({
            ...p,
            image: p.image || p.image_url || '',
          }));

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
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* زر الرجوع */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-extrabold text-temu-black mb-6 flex items-center gap-2">
          My Favorites 
          <span className="text-temu-error">❤️</span>
        </h1>

        {favoriteProducts.length === 0 ? (
          <div className="bg-white p-10 rounded-temu-sm border border-temu-gray-border-light text-center max-w-md mx-auto mt-10">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-gray-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <p className="text-temu-gray-text font-medium mb-6">You have no favorite products yet.</p>
            <button 
              onClick={() => router.push('/')} 
              className="bg-temu-orange text-white font-bold py-2 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {favoriteProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}