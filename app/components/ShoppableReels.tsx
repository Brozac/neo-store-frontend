'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PaymentModal from './PaymentModal';
import { useRouter } from 'next/navigation';
import { IMG } from '@/lib/imageOptimizer';
import GlassIcon, { GlassInline } from '@/components/ui/GlassIcon';


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
  // ✨ فلترة المنتجات التي تحتوي على فيديو، واختيار أول 8 فقط لمنع تكدس الصفحة
  const videoProducts = products.filter(p => p.video_url && p.video_url.trim().length > 0).slice(0, 8);
  // ✨ القسم يظهر فقط بفيديوهات حقيقية من DB — الديمو للتطوير فقط (Tenet #26)
  const DEMO_ALLOWED = process.env.NODE_ENV === 'development'; // inline وقت البناء — صفر runtime cost
  const activeReels: Product[] =
    videoProducts.length > 0 ? videoProducts
    : DEMO_ALLOWED ? CURATED_DEMO_REELS
    : [];

  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentReel = selectedReelIndex !== null ? activeReels[selectedReelIndex] : null;
  const router = useRouter();

  // ✨ Autoplay آمن: ديميوم muted فالبداية — unmute فقط بعد تفاعل مستخدم
  // (سياسات Chrome/Safari: autoplay بالصوت ممنوع — إلا حظرنا التبديل، الفيديو يجمّد)
  useEffect(() => {
    if (selectedReelIndex !== null && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.muted = true;       // نبدأ دائماً صامت — مضمون autoplay
      setIsMuted(true);
      v.play().catch(() => {
        // حتى muted ممكن يفشل نادراً — نشوف زر play يدوي
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [selectedReelIndex]);
    // ✨ أسهم الكيبورد — تجربة سطح مكتب سينمائية
  useEffect(() => {
    if (selectedReelIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedReelIndex(null);
      if (e.key === 'ArrowRight') nextReel();
      if (e.key === 'ArrowLeft') prevReel();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedReelIndex, activeReels.length]);

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
          <span className="text-xl animate-pulse"><GlassIcon ch="🎬" size="xs" /></span>
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
              className="relative aspect-[9/16] w-[42vw] max-w-[180px] sm:w-[180px] shrink-0 rounded-3xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-2xl transition-all duration-300 active:scale-95 ring-1 ring-black/5"
            >
              <Image
  src={IMG.card(img)}          // 🆕 400w webp بدل الأصل الكامل
  alt={reel.title}
  fill
  sizes="(max-width: 768px) 42vw, 180px"
  loading="lazy"                // 🆕 تحت الطية في أغلب الحالات
  className="object-cover group-hover:scale-110 transition-transform duration-700"
/>
              
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/40"></div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
              </div>

              <span className="absolute top-3 right-3 bg-[#FF6B9D] text-white text-[9px] font-black px-2 py-1 rounded-full uppercase shadow-lg tracking-wider">
                <GlassInline text={reel.badge || 'Live Drop'} />
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
          <GlassIcon ch="✨" size="xs" /> مشغل الريلز السينمائي ملء الشاشة (TikTok Style Full-Screen Player)
         ========================================================================= */}
      {selectedReelIndex !== null && currentReel && (
        <div 
          className="fixed inset-0 bg-black z-[250] flex items-center justify-center backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedReelIndex(null)}
        >
          {/* الحاوية الرئيسية: تملأ الشاشة على الهاتف، وتكون بحجم محدد على الكمبيوتر */}
          <div 
            className="relative w-full h-full sm:w-[400px] sm:h-[90vh] sm:max-h-[850px] bg-black sm:rounded-[2rem] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* الفيديو: مطلق (absolute) ويملأ الحاوية بنسبة 100% بدون أي هوامش سوداء */}
            <video
              ref={videoRef}
              // ✨ تمرير رابط الفيديو عبر مسار الـ Proxy لإضافة هيدر Referer
              src={`/api/video-proxy?url=${encodeURIComponent(currentReel.video_url || '')}`}
              loop
              playsInline
              muted={isMuted}
              autoPlay
              onClick={togglePlay}
              className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
            />

            {/* التدرج العلوي للشعار والأزرار */}
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-5 pt-7 bg-linear-to-b from-black/70 to-transparent">
              <div className="flex items-center gap-2">
                {/* ✨ شعار المتجر الرسمي يملأ الدائرة بالكامل بدون حواف وردية */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden shadow shrink-0 border border-white/20">
                  <Image 
  src="/icon-512.png"          // ✅ شعار المتجر — ما يتبدلش
  alt="Laclarc Logo" 
  fill 
  sizes="32px"
  className="object-cover" 

                  />
                </div>
                <span className="text-white text-xs font-black tracking-wide drop-shadow-lg">Laclarc Live</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="bg-black/40 backdrop-blur-md hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm border border-white/20 active:scale-90 transition"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <GlassIcon i="volumeX" bare size="sm" /> : <GlassIcon i="volume2" bare size="sm" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReelIndex(null)}
                  className="bg-black/40 backdrop-blur-md hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border border-white/20 active:scale-90 transition"
                >
                  <GlassIcon i="x" size="xs" />
                </button>
              </div>
            </div>

            {!isPlaying && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl border border-white/30">
                  <GlassIcon ch="▶" size="xs" />
                </div>
              </div>
            )}

            {/* أزرار التنقل الجانبية (يسار ويمين) */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
              <button
                type="button"
                onClick={prevReel}
                className="w-9 h-9 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition"
                title="Previous Video"
              >
                <GlassIcon ch="▲" size="xs" />
              </button>
              <button
                type="button"
                onClick={nextReel}
                className="w-9 h-9 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition"
                title="Next Video"
              >
                <GlassIcon ch="▼" size="xs" />
              </button>
            </div>

            {/* بطاقة الشراء الزجاجية السفلية (مع هوامش آمنة Safe Area) */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pb-8 bg-linear-to-t from-black via-black/80 to-transparent">
              <div className="bg-white/10 backdrop-blur-xl p-3.5 rounded-2xl border border-white/20 flex items-center justify-between gap-3 shadow-2xl">
                
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 border border-white/20">
                    <Image
  src={IMG.thumb(currentReel.image_url || currentReel.image || '/icon-512.png')}   // ✅
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
                  onClick={() => {
                    // 🛡️ حماية مالية (Tenet #1): منتجات الـ demo ما عندهاش DB entry
                    // الدفع عليها = crash ولا item زائف
                    if (String(currentReel.id).startsWith('demo-')) {
                      // نوجه للكتالوغ الحقيقي بدل الدفع الزائف
                      setSelectedReelIndex(null);
                      router.push('/#catalog');
                      return;
                    }
                    setIsPaymentOpen(true);
                  }}
                  className="bg-linear-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shrink-0 active:scale-95 transition shadow-lg shadow-pink-500/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <span><GlassIcon i="zap" size="xs" /></span> Buy Now
                </button>
              </div>

              <div className="text-center mt-3">
                <Link
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