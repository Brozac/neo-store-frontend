'use client';

// ════════════════════════════════════════════════════════════════
// Navbar — SERENE v2.1 (طبق الأصل من laclarc-serene-v2)
// · شريط إعلانات ضبابي فاتح (bg fog-200 — لا أسود ثقيل)
// · رأس أبيض زجاجي: أيقونة الشعار الرسمية + LACLARC بخط Marcellus
//   + searchpill + أيقونات fog · بادج السلة وردي ناعم (#D98A8A)
// ════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { useCart } from '../context/CartContext';
import SearchBar from './SearchBar';
import { HeartIcon, GlobeShippingIcon, LockIcon } from '@/components/icons/LaclarcIcons';

export default function Navbar() {
  const { totalItemsCount, isMounted } = useCart();

  return (
    <header className="sticky top-0 z-50">
      {/* شريط الإعلانات — ضبابي فاتح (شريحة chip-mini من المعاينة) */}
      <div className="bg-fog-200/80 backdrop-blur-md text-fog-700 text-center py-2 px-4 text-[11px] sm:text-xs font-bold tracking-wide border-b border-fog-300/40">
        <div className="max-w-7xl mx-auto flex justify-between sm:justify-center items-center gap-4 sm:gap-8">
          <span className="flex items-center gap-1.5">
            <span className="text-maroccan-tea-600">
              <GlobeShippingIcon size={14} active />
            </span> Free Worldwide Express Shipping
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="text-butter-up-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 12.5H11L9.5 22L19 10H12.5L13 2Z" /></svg>
            </span> 100% Satisfaction Guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-fog-500">
              <LockIcon size={13} active />
            </span> Bank-Grade Secure Checkout
          </span>
        </div>
      </div>

      {/* الرأس الأبيض الزجاجي — apphead تاع المعاينة */}
      <nav className="bg-white/88 backdrop-blur-xl px-4 py-2.5 sm:py-3 border-b border-fog-200 shadow-[0_4px_18px_rgba(91,126,166,0.09)]">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-3 sm:gap-6">

          {/* Brand lock — أيقونة الشعار الرسمية (مونوغرام LL) + Marcellus */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer" aria-label="Laclarc home">
            <img
              src="/icon-512.png"
              alt="Laclarc logo"
              width={44}
              height={44}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-fog-200/70 shadow-[0_10px_22px_rgba(70,100,138,0.22)] group-active:scale-95 transition select-none"
            />
            <span className="hidden sm:flex font-brand text-lg sm:text-xl text-fog-800 leading-none">LACLARC</span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block flex-1 max-w-xl">
            <SearchBar />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">

            {/* Track Order (Desktop) */}
            <Link
              href="/track-order"
              className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-fog-600 hover:text-fog-700 px-3.5 py-2 rounded-full bg-fog-100 hover:bg-fog-200 transition cursor-pointer"
              title="Track Your Order"
            >
              <span>Track Order</span>
            </Link>

            {/* Favorites — قلب أوتلاين fog */}
            <Link
              href="/favorites"
              className="w-10 h-10 sm:w-11 sm:h-11 grid place-items-center rounded-2xl bg-white border border-fog-200 text-fog-700 hover:bg-fog-100 transition cursor-pointer active:scale-90 shadow-[0_4px_18px_rgba(91,126,166,0.09)]"
              aria-label="Wishlist"
              title="Favorite Products"
            >
              <HeartIcon size={20} />
            </Link>

            {/* Shopping Cart — بادج وردي ناعم (badge تاع المعاينة) */}
            <Link
              href="/cart"
              className="relative w-10 h-10 sm:w-11 sm:h-11 grid place-items-center rounded-2xl bg-white border border-fog-200 text-fog-700 hover:bg-fog-100 transition cursor-pointer active:scale-90 shadow-[0_4px_18px_rgba(91,126,166,0.09)]"
              aria-label="Shopping Cart"
              title="Shopping Cart"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8h12l1.3 11a2 2 0 0 1-2 2.2H6.7a2 2 0 0 1-2-2.2z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>

              {isMounted && totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-coral-500 text-white text-[10px] font-black min-w-5 h-5 px-1 flex items-center justify-center rounded-full border-2 border-white shadow-md animate-scale">
                  {totalItemsCount > 99 ? '99+' : totalItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mt-2.5">
          <SearchBar />
        </div>
      </nav>
    </header>
  );
}
