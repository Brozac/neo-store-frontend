'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PaymentModal from './PaymentModal';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image_url?: string;
  image?: string;
  video_url?: string;
  badge?: string;
}

// ✨ تحديد النوع Product[] بشكل صريح لمنع خطأ TypeScript 2339
const CURATED_DEMO_REELS: Product[] = [
  {
    id: 'demo-1',
    title: 'Precision Electric Shaver & Trimmer',
    price: 34.99,
    original_price: 59.99,
    image_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    badge: 'Trending 🔥'
  },
  {
    id: 'demo-2',
    title: 'High-Tech Air Quality & Temp Detector',
    price: 49.99,
    original_price: 79.99,
    image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    badge: 'Viral TikTok ⚡'
  },
  {
    id: 'demo-3',
    title: 'Ultra-Fast Ergonomic Grooming Kit',
    price: 39.99,
    original_price: 64.99,
    image_url: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    badge: 'Must Have 🏆'
  }
];

export default function ShoppableReels({ products = [] }: { products?: Product[] }) {
  const videoProducts = products.filter(p => p.video_url && p.video_url.trim().length > 0);
  const activeReels: Product[] = videoProducts.length > 0 ? videoProducts : CURATED_DEMO_REELS;

  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentReel = selectedReelIndex !== null ? activeReels[selectedReelIndex] : null;

  useEffect(() => {
    if (selectedReelIndex !== null && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [selectedReelIndex]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextReel = () => {
    if (selectedReelIndex !== null) {
      setSelectedReelIndex((selectedReelIndex + 1) % activeReels.length);
    }
  };

  const prevReel = () => {
    if (selectedReelIndex !== null) {
      setSelectedReelIndex((selectedReelIndex - 1 + activeReels.length) % activeReels.length);
    }
  };

  if (!activeReels || activeReels.length === 0) return null;

  const safePrice = currentReel ? Number(currentReel.price) || 0 : 0;
  const safeCartItems = currentReel ? [{
    id: currentReel.id,
    name: currentReel.title,
    title: currentReel.title,
    price: safePrice,
    quantity: 1,
    image: currentReel.image_url || currentReel.image || '/icon-512.png',
  }] : [];

  return (
    <section className="my-10 w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-pulse">🎬</span>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
              Watch & Shop <span className="text-[#FF6B9D]">&bull; Reels</span>
            </h2>
            <p className="text-xs text-gray-500">See trending innovations tested live in action</p>
          </div>
        </div>
        <span className="text-xs font-bold text-[#8B78C6] uppercase tracking-wider bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
          Tap to Watch
        </span>
      </div>

      {/* Horizontal Story Cards Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide touch-pan-x px-2">
        {activeReels.map((reel, idx) => {
          const price = Number(reel.price) || 0;
          const img = reel.image_url || reel.image || '/icon-512.png';

          return (
            <div
              key={reel.id || idx}
              onClick={() => setSelectedReelIndex(idx)}
              className="relative aspect-9/16 w-36 sm:w-44 shrink-0 rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300 active:scale-95 border-2 border-transparent hover:border-[#8B78C6]"
            >
              <Image
                src={img}
                alt={reel.title}
                fill
                sizes="(max-width: 768px) 150px, 180px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* ✨ تحديث الكلاس إلى صيغة Tailwind v4: bg-linear-to-t */}
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-black/30"></div>

              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md w-7 h-7 rounded-full flex items-center justify-center text-white text-xs border border-white/20">
                ▶
              </div>

              <span className="absolute top-3 right-3 bg-[#FF6B9D] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow">
                {reel.badge || 'Live Drop'}
              </span>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-xs font-bold line-clamp-2 leading-snug mb-1 drop-shadow">
                  {reel.title}
                </p>
                <p className="text-sm font-black text-amber-300">
                  ${price.toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          ✨ مشغل الريلز السينمائي ملء الشاشة (TikTok Video Player)
         ========================================================================= */}
      {selectedReelIndex !== null && currentReel && (
        <div 
          className="fixed inset-0 bg-black/95 z-250 flex items-center justify-center p-0 sm:p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedReelIndex(null)}
        >
          <div 
            className="relative w-full sm:max-w-md h-full sm:h-[90vh] bg-black sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={currentReel.video_url}
              loop
              playsInline
              muted={isMuted}
              autoPlay
              onClick={togglePlay}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
            />

            {/* ✨ تحديث الكلاسات إلى صيغة Tailwind v4 */}
            <div className="relative z-20 flex justify-between items-center p-4 bg-linear-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#8B78C6] to-[#FF6B9D] flex items-center justify-center font-black text-white text-xs shadow">
                  L
                </div>
                <span className="text-white text-xs font-black tracking-wide">Laclarc Live</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm border border-white/20 active:scale-90 transition"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReelIndex(null)}
                  className="bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border border-white/20 active:scale-90 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {!isPlaying && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl border border-white/30">
                  ▶
                </div>
              </div>
            )}

            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
              <button
                type="button"
                onClick={prevReel}
                className="w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition"
                title="Previous Video"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={nextReel}
                className="w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition"
                title="Next Video"
              >
                ▼
              </button>
            </div>

            {/* بطاقة الشراء الزجاجية */}
            <div className="relative z-20 p-4 bg-linear-to-t from-black/95 via-black/80 to-transparent">
              <div className="bg-white/10 backdrop-blur-xl p-3.5 rounded-2xl border border-white/20 flex items-center justify-between gap-3 shadow-2xl">
                
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 border border-white/20">
                    <Image
                      src={currentReel.image_url || currentReel.image || '/icon-512.png'}
                      alt={currentReel.title}
                      fill
                      sizes="48px"
                      className="object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{currentReel.title}</h4>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-sm font-black text-[#FF6B9D]">${safePrice.toFixed(2)}</span>
                      {Number(currentReel.original_price) > safePrice && (
                        <span className="text-[10px] text-gray-400 line-through">
                          ${Number(currentReel.original_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(true)}
                  className="bg-linear-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shrink-0 active:scale-95 transition shadow-lg shadow-pink-500/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⚡</span> Buy Now
                </button>
              </div>

              <div className="text-center mt-2.5">
                <Link
                  href={`/products/${currentReel.id}`}
                  onClick={() => setSelectedReelIndex(null)}
                  className="text-[11px] text-gray-300 hover:text-white font-semibold underline"
                >
                  View full specifications & customer reviews &rarr;
                </Link>
              </div>
            </div>

          </div>

          <PaymentModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            cartItems={safeCartItems}
            totalAmount={safePrice}
          />
        </div>
      )}
    </section>
  );
}