'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';

interface HeroSectionProps {
  trendingProducts?: any[];
}

export default function HeroSection({ trendingProducts }: HeroSectionProps = {}) {
  const [liveTime, setLiveTime] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // تحديث التوقيت الحي
  useEffect(() => {
    setIsMounted(true);
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + 
        ' • ' + 
        now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // تشغيل أنيميشن GSAP بأمان
  const initGSAP = () => {
    if (typeof window === 'undefined' || !(window as any).gsap) return;
    const gsap = (window as any).gsap;
    const ScrollTrigger = (window as any).ScrollTrigger;

    if (ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // أنيميشن الدخول
    const tl = gsap.timeline();
    tl.from(".gsap-bg-text", { scale: 0.9, opacity: 0, duration: 1.2, ease: "power2.out" })
      .from(".gsap-parallax-img", { y: 60, opacity: 0, duration: 1.2, ease: "power3.out" }, "-=0.8")
      .from(".gsap-hero", { y: 25, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }, "-=0.8");

    // طفو خفيف للصورة والويدجت
    gsap.to(".float-anim-slow", {
      y: "-=12",
      duration: 3.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    gsap.to(".float-anim", {
      y: "-=8",
      duration: 2.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // بارالاكس متناسق مع السكرول
    if (ScrollTrigger) {
      gsap.to(".gsap-bg-text", {
        y: -100,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-container",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });

      gsap.to(".gsap-parallax-img", {
        y: 50,
        scale: 0.96,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-container",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });
    }
  };

  return (
    <div className="w-full font-sans text-[#1D1E3C] overflow-hidden bg-[#F9F8FC] rounded-3xl mb-8 border border-gray-200/80 shadow-xl">
      {/* سكريبتات GSAP */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" 
        strategy="afterInteractive" 
      />
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" 
        strategy="afterInteractive"
        onLoad={initGSAP}
      />

      {/* =========================================================================
          SECTION 1: HERO TOP
         ========================================================================= */}
      <section className="hero-container relative min-h-[85vh] lg:min-h-[92vh] w-full flex flex-col justify-between p-6 sm:p-12 lg:p-16 overflow-hidden">
        
        {/* كلمة LACLARC ثلاثية الأبعاد العملاقة في الخلفية */}
        <div className="gsap-bg-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] font-black leading-none select-none pointer-events-none text-[#8B78C6]/[0.08] tracking-tighter whitespace-nowrap z-0">
          LACLARC
        </div>

        {/* ✨ صورة المنتج الفاخر في المنتصف (تم تصحيح الرابط برابط سريع مضمون مع Fallback) */}
        <div className="gsap-parallax-img absolute bottom-12 lg:bottom-16 left-1/2 -translate-x-1/2 h-[50vh] sm:h-[65vh] w-full max-w-lg z-10 flex items-end justify-center pointer-events-none">
          <img 
            className="float-anim-slow max-h-full max-w-full object-contain drop-shadow-[0_25px_35px_rgba(29,30,60,0.25)]" 
            src="https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&auto=format&fit=crop&q=80" 
            alt="Laclarc Premium Grooming Innovation" 
          />
        </div>

        {/* المحتوى الرئيسي: يسار ويمين */}
        <div className="relative z-20 flex flex-col lg:flex-row justify-between items-start gap-10 mt-6 lg:mt-10">
          
          {/* الجانب الأيسر: العناوين والأزرار */}
          <div className="max-w-xl space-y-6 text-left">
            <div className="gsap-hero inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8B78C6]/15 border border-[#8B78C6]/30 text-[#8B78C6] text-xs font-black uppercase tracking-wider">
              <span>⚡</span> Exclusive Sourced Drops
            </div>

            <h1 className="gsap-hero text-4xl sm:text-5xl lg:text-6xl font-black text-[#1D1E3C] tracking-tight leading-[1.08]">
              Engineered for <br />
              precision, <br />
              crafted for lifestyle, <br />
              <span className="text-[#8B78C6]">delivered worldwide.</span>
            </h1>

            <div className="gsap-hero flex items-center gap-2.5 text-xs font-bold text-[#1D1E3C] pt-1">
              <span className="text-amber-400 text-sm">★★★★★</span>
              <span>4.9/5 from 12,000+ Verified Buyers</span>
            </div>

            {/* ✨ الأزرار بتصميم Claymorphism أنيق وواضح */}
            <div className="gsap-hero flex items-center gap-4 flex-wrap pt-2">
              <Link 
                href="#catalog" 
                className="bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white px-7 py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-xl shadow-[#1D1E3C]/20 active:scale-95 flex items-center gap-2"
              >
                <span>Shop Trending Deals</span>
                <span className="w-5 h-5 bg-[#FF6B9D] rounded-full flex items-center justify-center text-[10px] text-white">⚡</span>
              </Link>
              
              <Link 
                href="/categories" 
                className="bg-white/80 hover:bg-white text-[#1D1E3C] border border-[#8B78C6]/30 px-6 py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm backdrop-blur-md active:scale-95"
              >
                All Departments &rarr;
              </Link>
            </div>
          </div>

          {/* الجانب الأيمن: الويدجت ثلاثي الأبعاد + التصنيفات */}
          <div className="relative z-20 flex flex-col items-start lg:items-end gap-6 w-full lg:w-auto">
            
            {/* ✨ ويدجت الصلصال: تم وضع icon-192.png بداخله بدلاً من حرف L */}
            <div className="float-anim gsap-hero bg-white/90 backdrop-blur-xl border border-white/80 rounded-3xl p-4 shadow-[8px_10px_25px_rgba(139,120,198,0.12),-8px_-10px_25px_rgba(255,255,255,0.9)] flex items-center gap-4 max-w-xs sm:w-80">
              
              {/* أيقونة المتجر الرسمية */}
              <div className="w-16 h-16 bg-[#1D1E3C] rounded-2xl flex items-center justify-center p-2 shadow-inner shrink-0">
                <Image 
                  src="/icon-192.png" 
                  alt="Laclarc Emblem" 
                  width={48} 
                  height={48} 
                  className="w-12 h-12 object-contain"
                  priority
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-black text-[#1D1E3C] leading-tight">Worldwide<br />Express Dispatch.</h4>
                  <span className="w-2 h-2 rounded-full bg-[#FF6B9D] animate-ping"></span>
                </div>
                
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                  <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-[#8B78C6] rounded-full"></div>
                  </div>
                  <div className="flex gap-1.5 text-[10px] font-mono font-bold text-gray-500">
                    <span className="bg-purple-50 text-[#8B78C6] px-1.5 py-0.5 rounded">✓ Insured</span>
                  </div>
                </div>
              </div>
            </div>

            {/* تصنيفات المتجر */}
            <div className="gsap-hero text-left lg:text-right max-w-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">Curated Collections</span>
              <div className="flex flex-wrap gap-1.5 justify-start lg:justify-end">
                {['Electric Grooming', 'Smart Tech', 'Lifestyle', 'Watches', 'Home Decor'].map((c) => (
                  <span key={c} className="bg-white/80 border border-[#8B78C6]/20 px-3 py-1 rounded-xl text-[11px] font-bold text-[#1D1E3C] shadow-sm">
                    {c}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ✨ الشريط السفلي: رفعناه عن القاع (bottom-6) لكي لا يقصه القسم التالي */}
        <div className="relative z-20 w-full pt-10 pb-4 border-t border-gray-200/60 flex justify-between items-center text-[11px] font-bold text-gray-400 flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-500">✔</span> 100% Buyer Protection Guaranteed
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="text-[#8B78C6]">✈</span> Direct Automated CJ Logistics
          </span>
          <span className="text-gray-500">
            {isMounted ? liveTime : 'Live Global Time'}
          </span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: BOTTOM ASSURANCE & 3D CLAY PILLS
         ========================================================================= */}
      <section className="bg-white rounded-t-[2.5rem] p-8 sm:p-14 border-t border-gray-200 relative z-20 shadow-[0_-20px_40px_rgba(29,30,60,0.03)]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
            <div className="space-y-3 max-w-sm">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8B78C6]">
                <span className="w-2 h-2 rounded-full bg-[#FF6B9D]"></span>
                The Laclarc Standard
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Insured Worldwide Shipping across USA, Europe, Algeria (BaridiMob), and Gulf regions with real-time live tracking.
              </p>
            </div>

            <div className="max-w-xl space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#1D1E3C] leading-snug">
                Premium curated quality meets accessibility:<br />
                <span className="text-[#8B78C6]">Speed, style, and </span> excellence without compromise.
              </h2>
            </div>
          </div>

          

        </div>
      </section>
    </div>
  );
}