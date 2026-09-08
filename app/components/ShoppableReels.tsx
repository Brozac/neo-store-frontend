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
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    badge: 'Must Have 🏆'
  },
  {
    id: 'demo-4',
    title: 'Smart Posture Corrector & Massager',
    price: 29.99,
    original_price: 49.99,
    image_url: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    badge: 'Health Boost 🩺'
  },
  {
    id: 'demo-5',
    title: 'Wireless Bluetooth Sleep Mask',
    price: 19.99,
    original_price: 34.99,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    badge: 'Best Seller 🌙'
  },
  {
    id: 'demo-6',
    title: 'Mini Portable Espresso Machine',
    price: 45.99,
    original_price: 69.99,
    image_url: 'https://images.unsplash.com/photo-1610889556528-9a770e32642c?w=500&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1610889556528-9a770e32642c?w=500&auto=format&fit=crop&q=80',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    badge: 'New Arrival ✨'
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
      <div className="flex gap-4 overflow-x-auto pb-5 scrollbar-hide touch-pan-x pl-4 sm:pl-6 pr-4 sm:pr-6">
        {activeReels.map((reel, idx) => {
          const price = Number(reel.price) || 0;
          const img = reel.image_url || reel.image || '/icon-512.png';

          return (
            <div
              key={reel.id || idx}
              onClick={() => setSelectedReelIndex(idx)}
              // ✨ استخدام w-[42vw] لجعل البطاقة تأخذ 42% من عرض الشاشة على الهاتف
              // هذا يضمن أن البطاقة الثالثة ستظهر مقصوصة قليلاً للإيحاء بالسحب، ويمنع الفراغات الكبيرة
              className="relative aspect-[9/16] w-[42vw] max-w-[180px] sm:w-[180px] shrink-0 rounded-3xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-2xl transition-all duration-300 active:scale-95 ring-1 ring-black/5"
            >
              <Image
                src={img}
                alt={reel.title}
                fill
                sizes="(max-width: 768px) 42vw, 180px"
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
              
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/40"></div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
              </div>

              <span className="absolute top-3 right-3 bg-[#FF6B9D] text-white text-[9px] font-black px-2 py-1 rounded-full uppercase shadow-lg tracking-wider">
                {reel.badge || 'Live Drop'}
              </span>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-xs font-bold line-clamp-2 leading-tight mb-1 drop-shadow-lg">
                  {reel.title}
                </p>
                <p className="text-base font-black text-amber-300 drop-shadow-lg">
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

            <div className="relative z-20 flex justify-between items-center p-4 bg-linear-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                {/* ✨ استبدال حرف L بشعار المتجر الرسمي */}
                <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#8B78C6] to-[#FF6B9D] flex items-center justify-center p-1 shadow overflow-hidden">
                  <Image 
                    src="/icon-512.png" 
                    alt="Laclarc Logo" 
                    width={20} 
                    height={20} 
                    className="w-full h-full object-contain" 
                  />
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

              <div className="text-center mt-3">
                <Link
                  // ✨ إذا كان المنتج تجريبي (demo)، نوجهه للصفحة الرئيسية. وإذا كان حقيقياً، نوجهه لصفحته.
                  href={String(currentReel.id).startsWith('demo-') ? '/' : `/products/${currentReel.id}`}
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