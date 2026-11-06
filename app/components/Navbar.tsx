'use client';

import Link from 'next/link';
import { useCart } from '../context/CartContext';
import SearchBar from './SearchBar';
import { useSiteConfig } from './SiteConfigProvider';
import { HeartIcon, GlobeShippingIcon, LockIcon } from '@/components/icons/LaclarcIcons';

// ═══════════════════════════════════════════════════════════════
// Navbar — Sérénité Edition 🕊️
// شريط إعلانات مريمي فاتح + زجاج أبيض شفاف — هدوء ووضوح
// (نفس البنية والروابط — الهوية البصرية فقط هي المتغيرة)
// ═══════════════════════════════════════════════════════════════
export default function Navbar() {
  const { totalItemsCount, isMounted } = useCart();
  // 👁️ F#93 — رابط تتبع الطلب كيختفي ملي الفرع مخفي (الصفحة نفسها محجوبة أصلاً)
  const { cfg } = useSiteConfig();
  const showTrack = cfg?.branches['track-order'] !== false;

  return (
    <header className="sticky top-0 z-50 shadow-[0_1px_0_rgba(51,65,58,0.06),0_8px_24px_-16px_rgba(51,65,58,0.18)]">
      {/* شريط الإعلانات العلوي — مريمي فاتح يبعث الاطمئنان */}
      <div className="bg-serene-mint text-temu-green text-center py-2 px-4 text-[11px] sm:text-xs font-bold tracking-wide border-b border-[#5F8271]/10">
        <div className="max-w-7xl mx-auto flex justify-between sm:justify-center items-center gap-4 sm:gap-8">
          <span className="flex items-center gap-1.5">
            <GlobeShippingIcon size={14} active />
            Free Worldwide Express Shipping
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 12.5H11L9.5 22L19 10H12.5L13 2Z" /></svg>
            100% Satisfaction Guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <LockIcon size={13} active />
            Bank-Grade Secure Checkout
          </span>
        </div>
      </div>

      {/* شريط التنقل الأساسي — زجاج أبيض دافئ */}
      <nav className="bg-white/85 backdrop-blur-xl text-temu-black px-4 py-3 sm:py-3.5 border-b border-temu-gray-border-light">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 sm:gap-8">

          {/* ✨ BRAND — icon-512 + LACLARC بخط Marcellus (طلب المالك 2026-11-06)
              Marcellus محمّل عبر next/font (layout.tsx) و .font-brand في globals.css */}
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap active:scale-95 transition cursor-pointer"
          >
            <img
              src="/icon-512.png"
              alt="Laclarc"
              width={38}
              height={38}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white ring-1 ring-temu-gray-border-light shadow-sm object-contain p-0.5"
            />
            <span className="text-2xl sm:text-3xl font-black tracking-wider text-temu-green font-brand uppercase">
              Laclarc
            </span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block flex-1 max-w-xl">
            <SearchBar />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Track Order (Desktop) — 👁️ F#93 */}
            {showTrack && (
              <Link
                href="/track-order"
                className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-temu-gray-text hover:text-temu-green px-3 py-2 rounded-xl hover:bg-serene-mint transition cursor-pointer"
                title="Track Your Order"
              >
                <span>Track Order</span>
              </Link>
            )}

            {/* Favorites — HeartIcon duotone */}
            <Link
              href="/favorites"
              className="p-2 hover:bg-serene-mint rounded-xl transition cursor-pointer active:scale-90 text-temu-gray-text hover:text-temu-green"
              aria-label="Wishlist"
              title="Favorite Products"
            >
              <HeartIcon size={22} />
            </Link>

            {/* Shopping Cart — Bag مع قلب Laclarc */}
            <Link
              href="/cart"
              className="relative p-2.5 bg-serene-mint hover:bg-[#5F8271]/15 rounded-xl transition cursor-pointer active:scale-90 flex items-center justify-center border border-[#5F8271]/15 text-temu-green"
              aria-label="Shopping Cart"
              title="Shopping Cart"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>

              {isMounted && totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-temu-error text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md animate-scale">
                  {totalItemsCount > 99 ? '99+' : totalItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mt-3 pt-2 border-t border-temu-gray-border-light">
          <SearchBar />
        </div>
      </nav>
    </header>
  );
}
