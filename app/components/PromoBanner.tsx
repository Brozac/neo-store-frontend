'use client';

import Link from 'next/link';
import { IMG } from '@/lib/imageOptimizer';

// ══════════════════════════════════════════════════════════════════
// PromoBanner — MERGE_MOCKUP (دمج ذكي — موكاب الصفحة الرئيسية)
//
// البانر الناعم تاع الموكاب: تسمية صغيرة (Special Offer) + عنوان
// كبير + سطر OFF + زر Shop Now — بلكنة fog تاع Laclarc (fog-50 →
// لافندر ناعم) مع صورة منتج حقيقي من عروض الفلاش (ماشي صورة ديكور
// مزيفة — فلسفة الصدق تاع المشروع).
//
// بلا client state — server-renderable داخل client parent (HomeClient).
// ══════════════════════════════════════════════════════════════════

export default function PromoBanner({ products }: { products: any[] }) {
  const hero = Array.isArray(products) ? products[0] : null;
  const img = hero ? IMG.detail(hero.image_url || hero.image || '') : null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-linear-to-br from-fog-50 via-[#F4EFFB] to-[#EDE3F9] border border-fog-200/60 mb-8"
      aria-label="Special offer"
    >
      <div className="relative z-10 p-6 sm:p-8 max-w-[68%]">
        <span className="text-[11px] font-black uppercase tracking-widest text-fog-600">
          Special Offer
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-temu-black leading-tight mt-1.5">
          Trending
          <br />
          Collection
        </h2>
        <p className="text-sm font-black text-fog-600 mt-1.5">Up to 50% OFF</p>

        <Link
          href="/all-products"
          className="inline-flex items-center gap-1.5 mt-4 bg-fog-700 hover:bg-fog-600 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-fog-500/30 active:scale-95 transition cursor-pointer"
        >
          Shop Now
        </Link>
      </div>

      {img && (
        <img
          src={img}
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden="true"
          className="absolute right-0 bottom-0 h-[88%] w-[36%] object-contain object-bottom drop-shadow-xl"
        />
      )}
    </section>
  );
}
