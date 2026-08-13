'use client';

import Link from 'next/link';
import { useCart } from '../context/CartContext';
import SearchBar from './SearchBar'; // ✨ استيراد مكون البحث الذكي

export default function Navbar() {
  const { cart } = useCart();
  const itemCount = cart.reduce((total: number, item: any) => total + item.quantity, 0);

  return (
    <>
      {/* الشريط العلوي */}
      <nav className="bg-linear-to-r from-temu-orange to-temu-error text-temu-black px-4 py-3 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          
          <Link href="/" className="text-2xl font-extrabold tracking-wide text-temu-black whitespace-nowrap drop-shadow-md">
            NEO
          </Link>

          {/* ✨ استبدال الفورم القديم بمكون البحث الذكي (يظهر على الشاشات الكبيرة) */}
          <div className="hidden md:block flex-1 max-w-2xl">
            <SearchBar />
          </div>

          <Link href="/cart" className="relative p-2 hover:bg-white/30 rounded-temu-sm transition cursor-pointer">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-temu-error text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-temu-orange shadow-sm">
                {itemCount}
              </span>
            )}
          </Link>
        </div>

        {/* ✨ شريط البحث للهواتف المحمولة (يظهر فقط على الشاشات الصغيرة) */}
        <div className="md:hidden mt-3">
          <SearchBar />
        </div>
      </nav>

      <div className="bg-temu-green text-white text-center py-2 text-xs font-medium px-4">
        <div className="max-w-7xl mx-auto flex justify-center items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">✔ Free Shipping Worldwide</span>
          <span className="hidden md:flex items-center gap-1">✔ Secure Payments</span>
          <span className="hidden md:flex items-center gap-1">✔ 90-Day Returns</span>
        </div>
      </div>
    </>
  );
}