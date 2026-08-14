'use client';

import Link from 'next/link';
import { useCart } from '../context/CartContext';
import SearchBar from './SearchBar';

export default function Navbar() {
  const { cart } = useCart();
  const itemCount = cart.reduce((total: number, item: any) => total + item.quantity, 0);

  return (
    <>
      {/* الشريط العلوي */}
      {/* ✨ تغيير لون النص إلى الأبيض ليتناسب مع الخلفية المتدرجة (بنفسجي/وردي) */}
      <nav className="bg-linear-to-r from-temu-orange to-temu-error text-white px-4 py-3 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          
          {/* ✨ إضافة active:scale-95 و touch-manipulation للوغو */}
          <Link 
            href="/" 
            className="text-2xl font-extrabold tracking-wide text-white whitespace-nowrap drop-shadow-md active:scale-95 transition touch-manipulation cursor-pointer"
          >
            NEO
          </Link>

          {/* البحث للشاشات الكبيرة */}
          <div className="hidden md:block flex-1 max-w-2xl">
            <SearchBar />
          </div>

          {/* ✨ إضافة active:scale-90 و touch-manipulation لزر السلة + aria-label */}
          <Link 
            href="/cart" 
            className="relative p-2 hover:bg-white/20 rounded-temu-sm transition cursor-pointer active:scale-90 touch-manipulation"
            aria-label="Shopping Cart"
          >
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

        {/* البحث للهواتف المحمولة */}
        <div className="md:hidden mt-3">
          <SearchBar />
        </div>
      </nav>

      {/* شريط الثقة */}
      {/* ✨ تغيير الخلفية إلى temu-black لتناسق أفضل مع الهايدر */}
      <div className="bg-temu-black text-white text-center py-2 text-xs font-medium px-4">
        <div className="max-w-7xl mx-auto flex justify-center items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">✔ Free Shipping Worldwide</span>
          <span className="hidden md:flex items-center gap-1">✔ Secure Payments</span>
          <span className="hidden md:flex items-center gap-1">✔ 90-Day Returns</span>
        </div>
      </div>
    </>
  );
}