'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface SearchResult {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // جلب نتائج البحث مع تأخير بسيط (Debounce) لتقليل الطلبات
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    setIsLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`https://neo-store-backend.onrender.com/api/search?q=${encodeURIComponent(query)}`);
        
        // ✨ التأكد من أن الرد هو JSON وليس صفحة HTML
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          console.error('Search response is not JSON');
          setResults([]);
          return;
        }

        const data = await res.json();
        setResults(data);
        setIsDropdownOpen(true);
      } catch (error) {
        console.error('Search fetch error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

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
          placeholder="Search for products, brands, and more..."
          className="w-full bg-white border-2 border-temu-gray-border-light rounded-full py-3 pl-12 pr-28 text-sm text-temu-black focus:outline-none focus:border-temu-orange transition shadow-sm"
        />
        
        {/* أيقونة البحث */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-temu-gray-light">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {/* زر البحث */}
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-temu-orange hover:bg-temu-orange-bright text-white text-sm font-bold px-6 py-2 rounded-full transition cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* القائمة المنسدلة للنتائج (Autocomplete) */}
      {isDropdownOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-temu-sm shadow-2xl border border-temu-gray-border-light overflow-hidden max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-temu-gray-light text-sm animate-pulse">Searching...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((product) => {
                const imgSrc = product.image_url || '/placeholder.jpg';
                const safePrice = Number(product.price) || 0;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      router.push(`/products/${product.id}`);
                      setIsDropdownOpen(false);
                      setQuery('');
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-temu-offwhite cursor-pointer transition"
                  >
                    <div className="relative w-12 h-12 shrink-0 bg-temu-offwhite rounded-md overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={product.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={imgSrc.includes('localhost') || imgSrc.includes('127.0.0.1')}
                      />
                    </div>
                    <div className="grow overflow-hidden">
                      <p className="text-sm font-medium text-temu-black line-clamp-1">{product.title}</p>
                      <p className="text-sm font-bold text-temu-error">${safePrice.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* زر عرض كل النتائج */}
              <div className="p-2 mt-1 border-t border-temu-gray-border-light">
                <button 
                  onClick={handleSubmit}
                  className="w-full text-center text-sm font-bold text-temu-orange hover:text-temu-orange-bright py-2 cursor-pointer"
                >
                  View all results for "{query}"
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-temu-gray-light mb-2">No products found for "{query}"</p>
              <p className="text-xs text-temu-gray-text">Try different keywords or check spelling.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}