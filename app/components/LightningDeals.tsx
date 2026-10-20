'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import GlassIcon from '@/components/ui/GlassIcon';

interface Product { 
  id: number; 
  title: string; 
  price: number; 
  original_price: number; 
  image_url: string; 
}

export default function LightningDeals({ products }: { products: Product[] }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 48, seconds: 20 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // ضبط العداد ليدوم 5 ساعات متجددة تلقائياً
    const target = new Date();
    target.setHours(target.getHours() + 5);

    const timer = setInterval(() => {
      const now = new Date();
      const difference = target.getTime() - now.getTime();
      if (difference <= 0) target.setHours(target.getHours() + 5);

      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <section className="lightning-main-container my-10">
      {/* SVG Animated Turbulence Filters */}
      <svg className="lightning-svg-container" aria-hidden="true">
        <defs>
          <filter id="turbulent-displace" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
            <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
              <animate attributeName="dy" values="700; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
            <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
              <animate attributeName="dy" values="0; -700" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
            <feBlend in="part1" in2="part1" mode="color-dodge" result="combinedNoise" />
            <feDisplacementMap in="SourceGraphic" in2="combinedNoise" scale="20" xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>

      <div className="lightning-card-container">
        <div className="lightning-inner-container">
          <div className="lightning-border-outer">
            <div className="lightning-main-card"></div>
          </div>
          <div className="lightning-glow-layer-1"></div>
          <div className="lightning-glow-layer-2"></div>
        </div>
        <div className="lightning-overlay-1"></div>
        <div className="lightning-overlay-2"></div>
        <div className="lightning-background-glow"></div>

        <div className="lightning-content-container">
          {/* Header & Electric Countdown */}
          <div className="lightning-content-top flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="lightning-glass-badge inline-flex items-center gap-1.5 mb-1">
                <span><GlassIcon i="zap" size="xs" /></span> Exclusive Sourced Drops
              </div>
              <h2 className="lightning-title text-xl sm:text-2xl font-black tracking-wider">
                LIGHTNING DEALS
              </h2>
            </div>

            <div className="lightning-timer font-mono text-sm sm:text-base font-black px-4 py-2 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span>{isMounted ? String(timeLeft.hours).padStart(2, '0') : '04'}</span>:
              <span>{isMounted ? String(timeLeft.minutes).padStart(2, '0') : '48'}</span>:
              <span>{isMounted ? String(timeLeft.seconds).padStart(2, '0') : '20'}</span>
            </div>
          </div>

          <hr className="lightning-divider my-4 border-white/10" />

          {/* Deals Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto max-h-[480px] scrollbar-hide p-1">
            {products.map((p) => {
              const safePrice = Number(p.price) || 0;
              const safeOldPrice = Number(p.original_price) || 0;
              const discount = safeOldPrice > safePrice 
                ? Math.round(((safeOldPrice - safePrice) / safeOldPrice) * 100) 
                : 0;

              // ✨ حساب رقم مخزون شبه عشوائي متطابق بين السيرفر والعميل لمنع الـ Hydration Mismatch
              const stockLeft = (Number(p.id) * 7 % 7) + 3;

              return (
                <Link 
                  href={`/products/${p.id}`} 
                  key={p.id} 
                  className="group bg-[#0E1020]/80 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-[#8B78C6]/80 transition-all duration-300 active:scale-95 flex flex-col justify-between shadow-lg"
                >
                  <div className="relative aspect-square bg-white/5 overflow-hidden">
                    <Image 
                      src={p.image_url || '/placeholder.jpg'} 
                      alt={p.title} 
                      fill 
                      sizes="(max-width: 768px) 150px, 250px" 
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-500" 
                    />
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-linear-to-r from-red-600 to-[#FF6B9D] text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
                        -{discount}%
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="text-xs font-bold text-white line-clamp-2 mb-2 group-hover:text-[#8B78C6] transition">
                      {p.title}
                    </h3>
                    
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-base font-black text-[#FF6B9D]">${safePrice.toFixed(2)}</span>
                      {safeOldPrice > safePrice && (
                        <span className="text-[11px] text-gray-500 line-through">${safeOldPrice.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-black text-amber-400">
                      <span><GlassIcon i="zap" size="xs" /> Flash Left: {stockLeft}</span>
                      <span className="text-[9px] text-gray-400 font-normal">Claim &rarr;</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}