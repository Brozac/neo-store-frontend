'use client';

import Link from 'next/link';
import { useCart } from '../context/CartContext';
import SearchBar from './SearchBar';

export default function Navbar() {
  const { totalItemsCount, isMounted } = useCart();

  return (
    <header className="sticky top-0 z-50 shadow-md">
      {/* شريط الإعلانات العلوي الفاخر */}
      <div className="bg-[#1D1E3C] text-white text-center py-2 px-4 text-[11px] sm:text-xs font-bold tracking-wide">
        <div className="max-w-7xl mx-auto flex justify-between sm:justify-center items-center gap-4 sm:gap-8">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-400">✈️</span> Free Worldwide Express Shipping
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="text-amber-400">⚡</span> 100% Satisfaction Guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#FF6B9D]">🔒</span> Bank-Grade Secure Checkout
          </span>
        </div>
      </div>

      {/* شريط التنقل الأساسي */}
      <nav className="bg-gradient-to-r from-[#1D1E3C] via-[#8B78C6] to-[#1D1E3C] text-white px-4 py-3 sm:py-3.5 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 sm:gap-8">
          
          {/* Logo */}
          <Link 
            href="/" 
            className="text-2xl sm:text-3xl font-black tracking-wider text-white whitespace-nowrap active:scale-95 transition cursor-pointer drop-shadow"
          >
            Laclarc
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block flex-1 max-w-xl">
            <SearchBar />
          </div>

          {/* Quick Actions (Wishlist, Track Order, Cart) */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Direct Order Tracking Link (Desktop) */}
            <Link 
              href="/track-order" 
              className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-gray-200 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Track Your Order"
            >
              <span>Track Order</span>
            </Link>

            {/* Favorites Link */}
            <Link 
              href="/favorites" 
              className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer active:scale-90 text-gray-200 hover:text-white"
              aria-label="Wishlist"
              title="Favorite Products"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
              </svg>
            </Link>

            {/* Shopping Cart Button */}
            <Link 
              href="/cart" 
              className="relative p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer active:scale-90 flex items-center justify-center border border-white/15"
              aria-label="Shopping Cart"
              title="Shopping Cart"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>

              {/* ✨ حل ثغرة الـ Hydration: إظهار الشارة بعد التحميل فقط */}
              {isMounted && totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF6B9D] text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1D1E3C] shadow-md animate-scale">
                  {totalItemsCount > 99 ? '99+' : totalItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mt-3 pt-2 border-t border-white/10">
          <SearchBar />
        </div>
      </nav>
    </header>
  );
}