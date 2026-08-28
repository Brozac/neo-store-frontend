'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: number;
  title: string;
  price: number;
  original_price: number;
  image_url: string;
}

export default function LightningDeals({ products }: { products: Product[] }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 5, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date();
    target.setHours(target.getHours() + 5); // عداد يبدأ من 5 ساعات
    
    const timer = setInterval(() => {
      const now = new Date();
      const difference = target.getTime() - now.getTime();
      
      if (difference <= 0) {
        target.setHours(target.getHours() + 5);
      }

      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (products.length === 0) return null;

  return (
    <main className="lightning-main-container">
      {/* SVG Filter لتوليد الكهرباء */}
      <svg className="lightning-svg-container">
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
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="2" />
            <feOffset in="noise1" dx="0" dy="0" result="offsetNoise3">
              <animate attributeName="dx" values="490; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="2" />
            <feOffset in="noise2" dx="0" dy="0" result="offsetNoise4">
              <animate attributeName="dx" values="0; -490" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
            <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
            <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />
            <feDisplacementMap in="SourceGraphic" in2="combinedNoise" scale="20" xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>

      {/* بطاقة العروض الكهربائية */}
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

        {/* المحتوى الداخلي (المنتجات) */}
        <div className="lightning-content-container">
          <div className="lightning-content-top">
            <div className="lightning-glass-badge">⚡ Flash Deals</div>
            <h2 className="lightning-title">LIGHTNING DEALS</h2>
          </div>
          
          <div className="lightning-timer">
            <span>{String(timeLeft.hours).padStart(2, '0')}</span>:
            <span>{String(timeLeft.minutes).padStart(2, '0')}</span>:
            <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>

          <hr className="lightning-divider" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[400px] scrollbar-hide">
            {products.map((p) => {
              const discount = p.original_price > 0 ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0;
              const stockLeft = Math.floor(Math.random() * 10) + 2;

              return (
                <Link href={`/products/${p.id}`} key={p.id} className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition-all active:scale-95">
                  <div className="relative aspect-square bg-temu-offwhite overflow-hidden">
                    <Image src={p.image_url || '/placeholder.jpg'} alt={p.title} fill unoptimized={p.image_url?.includes('localhost')} sizes="200px" className="object-cover group-hover:scale-105 transition-transform" />
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-temu-error text-white text-xs font-bold px-2 py-1 rounded">-{discount}%</span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-white line-clamp-2 mb-2 h-10">{p.title}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-extrabold text-temu-error">${Number(p.price).toFixed(2)}</span>
                      {p.original_price > 0 && (
                        <span className="text-xs text-gray-400 line-through">${Number(p.original_price).toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-temu-error mt-1">ONLY {stockLeft} LEFT!</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}