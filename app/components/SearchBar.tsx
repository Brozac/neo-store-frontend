'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import GlassIcon from '@/components/ui/GlassIcon';

interface SearchResult {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
  image?: string;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // إغلاق القائمة عند النقر خارجها أو الضغط على Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ✨ جلب النتائج مع AbortController لمنع تضارب الطلبات السريعة (Race Conditions)
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      setResults([]);
      setIsDropdownOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        
        if (!res.ok) {
          setResults([]);
          return;
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          setResults(data);
          setIsDropdownOpen(true);
        } else {
          setResults([]);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort(); // إلغاء أي اتصال قيد الانتظار عند كتابة حرف جديد
    };
  }, [query, API_BASE_URL]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?search=${encodeURIComponent(query.trim())}`);
      setIsDropdownOpen(false);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsDropdownOpen(true)}
          placeholder="Search products, brands, and categories..."
          className="w-full bg-white/95 text-temu-black border border-white/20 rounded-full py-2.5 sm:py-3 pl-11 pr-24 text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6B3DB4] shadow-md transition touch-manipulation"
        />
        
        {/* Search Icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setIsDropdownOpen(false); }}
            className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-xs cursor-pointer active:scale-90"
          >
            <GlassIcon i="x" size="xs" />
          </button>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-linear-to-r from-[#7E56C4] to-coral-600 hover:brightness-110 text-white text-xs font-black px-4 sm:px-5 py-2 rounded-full transition cursor-pointer active:scale-95 shadow-md uppercase tracking-wider"
        >
          Search
        </button>
      </form>

      {/* Live Search Dropdown */}
      {isDropdownOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[65vh] overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="p-5 text-center text-gray-400 text-xs font-bold flex justify-center items-center gap-2 animate-pulse">
              <div className="w-4 h-4 border-2 border-[#6B3DB4] border-t-transparent rounded-full animate-spin"></div>
              Scanning Catalog...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2 divide-y divide-gray-50">
              {results.map((product) => {
                const imgSrc = product.image_url || product.image || '/placeholder.jpg';
                const safePrice = Number(product.price) || 0;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      router.push(`/products/${product.id}`);
                      setIsDropdownOpen(false);
                      setQuery('');
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition active:scale-[0.99]"
                  >
                    <div className="relative w-12 h-12 shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <Image
                        src={imgSrc}
                        alt={product.title || 'Product'}
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="grow min-w-0">
                      <p className="text-xs font-bold text-temu-black truncate">{product.title}</p>
                      <p className="text-xs font-black text-coral-600 mt-0.5">${safePrice.toFixed(2)}</p>
                    </div>
                    <span className="text-xs text-gray-400 font-bold">&rarr;</span>
                  </div>
                );
              })}
              
              <div className="p-2.5 bg-gray-50 text-center">
                <button 
                  onClick={handleSubmit}
                  className="w-full text-xs font-extrabold text-[#6B3DB4] hover:underline cursor-pointer active:scale-95"
                >
                  View all results for &ldquo;{query}&rdquo; &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-xs font-bold text-gray-700 mb-1">No products found matching &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] text-gray-400">Try searching for generic terms like &ldquo;shaver&rdquo;, &ldquo;bag&rdquo;, or &ldquo;watch&rdquo;.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}