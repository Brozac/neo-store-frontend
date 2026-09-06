'use client';

import Image from 'next/image';
import Link from 'next/link';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image?: string;
  image_url?: string;
}

export default function HeroSection({ trendingProducts = [] }: { trendingProducts?: Product[] }) {
  // ✨ حماية ضد undefined واختيار أفضل 4 منتجات
  const safeProducts = Array.isArray(trendingProducts) ? trendingProducts.slice(0, 4) : [];

  return (
    <section className="relative bg-[#0E1020] text-white rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl">
      {/* Background Decorative Mesh Glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#8B78C6]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#FF6B9D]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10 lg:py-14 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          
          {/* Left Column: Brand Statement & CTA */}
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Worldwide Express Dispatch</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Elevate Your Daily <br />
              <span className="bg-gradient-to-r from-[#8B78C6] via-[#FF6B9D] to-amber-300 bg-clip-text text-transparent">
                Lifestyle & Standards
              </span>
            </h1>

            <p className="text-sm sm:text-base text-gray-400 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              Curated premium gear, electric grooming innovations, and daily lifestyle essentials. Direct worldwide fulfillment with bank-grade security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link 
                href="#catalog" 
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold text-sm uppercase tracking-wider transition shadow-lg shadow-[#8B78C6]/30 active:scale-95 text-center"
              >
                Shop Trending Catalog &rarr;
              </Link>

              <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
                <span className="text-emerald-400 font-black">★ 4.9/5</span>
                <span>from 12,000+ Happy Customers</span>
              </div>
            </div>

            {/* Micro-Trust Strip */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t border-white/10 text-[11px] text-gray-400 font-medium">
              <div>✈️ Free Worldwide Shipping</div>
              <div>🔒 256-Bit Encrypted Payments</div>
              <div>🛡️ 30-Day Guarantee</div>
            </div>
          </div>

          {/* Right Column: Dynamic Trending Showcase Grid */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl p-4 sm:p-5 backdrop-blur-sm">
            
            {/* Header with Deal Badge (موضعه علوي نظيف لا يحجب المنتجات) */}
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Trending Showcase
                </h3>
              </div>
              <div className="flex items-center gap-1.5 bg-[#8B78C6]/20 border border-[#8B78C6]/40 px-2.5 py-1 rounded-full text-[10px] font-black text-white">
                <span>⚡</span> Up to 60% OFF
              </div>
            </div>
            
            {/* Grid */}
            <div className="grid grid-cols-2 gap-3">
              {safeProducts.length > 0 ? (
                safeProducts.map((p) => {
                  const safePrice = Number(p.price) || 0;
                  const safeOldPrice = Number(p.original_price) || 0;

                  return (
                    <Link 
                      href={`/products/${p.id}`} 
                      key={p.id} 
                      className="group block bg-white rounded-xl overflow-hidden active:scale-95 transition-all duration-300 hover:shadow-lg border border-transparent hover:border-[#8B78C6]/40"
                    >
                      <div className="relative aspect-square bg-white overflow-hidden">
                        <Image 
                          src={p.image_url || p.image || '/placeholder.jpg'} 
                          alt={p.title || 'Trending Product'} 
                          fill 
                          sizes="(max-width: 768px) 160px, 220px" 
                          className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5 bg-[#181B34]">
                        <p className="text-[11px] font-bold text-white line-clamp-1 group-hover:text-[#8B78C6] transition">
                          {p.title}
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-[#FF6B9D]">${safePrice.toFixed(2)}</span>
                          {safeOldPrice > safePrice && (
                            <span className="text-[10px] text-gray-400 line-through font-medium">
                              ${safeOldPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                // Skeleton Placeholders أثناء التحميل
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse border border-white/5"></div>
                ))
              )}
            </div>

            <div className="mt-3 text-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Direct CJ Warehouse Drops &bull; Updated Hourly
              </span>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}