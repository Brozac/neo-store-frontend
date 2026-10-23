'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { IMG } from '@/lib/imageOptimizer';
import GlassIcon from '@/components/ui/GlassIcon';

// ══════════════════════════════════════════════════════════════════
// HeroSection v2.1 — مراجعة عميقة (Task 7)
//
// 🛡️ FIX-RACE (gsap): السكريبتات async — ما عندهمش ترتيب تنفيذ مضمون.
//    ScrollTrigger يقدر ينفذ قبل gsap → initGSAP كان يخرج بصمت = صفر
//    أنيميشن للأبد (نفس عائلة "الموت الصامت"). دابا: poll ≤5s لـ gsap
//    + ScrollTrigger اختياري بتعلّق متأخر ≤10s + حرس عالمي ضد التكرار.
// 🛡️ FIX-EDGE: Math.ceil(random*50) يقدر يعطي 0 → page=0 → floor+1.
// 🛡️ FIX-SILENT: !res.ok ما بقاش صامت — console.warn بالـ status.
// 🛡️ FIX-GUARD: Array.isArray على كل فرع من فروع استخراج الـ list.
// 🧹 تم حذف 4 spans خاويين (كانو كيرندرو والو) — الإيموجي ⚡ بقا.
//
// ⚠️ M#45 — ادعاءات تجارية بلا سند موثق (قرار المالك، ما تبدلتش):
//    "Insured Worldwide Shipping" · "real-time live tracking" ·
//    "ships FREE worldwide" · "100% Buyer Protection"
//    → توثيق أو تخفيف، نفس ملف القرار ديال wrapper الفئة.
//
// 📐 Backlog معماري (موثق، ما نفذش): lib/sessionSeed.ts موحد —
//    getCatalogSeed() + mulberry32 + shufflePage (Tenet #31 للعشوائية).
//    ملاحظة: الهيرو كيستعمل seed خام، الكتالوغ كيمزج بـ pageNum*7919 —
//    الجوج deterministic وجلسة-مستقرة، ولكن "نفس الترتيب فينما بانو"
//    حرفيًا غير محقق بين السطوح (المجموعات مختلفة أصلاً).
// ══════════════════════════════════════════════════════════════════

interface HeroSectionProps {
  trendingProducts?: any[];
}

export default function HeroSection({ trendingProducts }: HeroSectionProps = {}) {
  const [liveTime, setLiveTime] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // ✨ v2: صفحة الـ hero — session-scoped (نفس الجلسة = نفس البطاقات · جلسة جديدة = mix جديد)
  // 🛡️ FIX-EDGE: floor+1 = مدى 1..50 مضمون (ceil كان يعطي 0 عند random()===0)
  // ملاحظة هشاشة: لا تعرض heroPage في JSX — القيمة تختلف SSR(1) عن العميل بعد hydration
  const [heroPage] = useState<number>(() => {
    if (typeof window === 'undefined') return 1; // SSR-safe (Tenet #2)
    try {
      const saved = sessionStorage.getItem('hero_page');
      if (saved) return Number(saved) || 1;
      const p = Math.floor(Math.random() * 50) + 1;
      sessionStorage.setItem('hero_page', String(p));
      return p;
    } catch {
      return 1; // sessionStorage محظور — ثابت
    }
  });

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

  // ✨ Seed مشترك مع الكتالوغ — نفس الجلسة = ترتيب deterministic فينما بانو المنتجات
  // (init بـ effect ماشي lazy-init: مقصود — التغيير بعد hydration باش ما يوقعش mismatch)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('catalog_seed');
      if (saved) {
        setShuffleSeed(Number(saved));
      } else {
        const seed = Math.floor(Math.random() * 1_000_000);
        sessionStorage.setItem('catalog_seed', String(seed));
        setShuffleSeed(seed);
      }
    } catch {
      setShuffleSeed(1); // sessionStorage محظور — seed ثابت (بلا دوّار)
    }
  }, []);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com'; // <GlassIcon ch="✨" size="xs" /> Tenet #4 + fallback

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      try {
        // ✨ v2: mosaic page من الجلسة — 12 منتج من فئات متنوعة · ثابت داخل الجلسة
        const res = await fetch(`${API_URL}/api/products?page=${heroPage}&limit=12`, { signal: controller.signal });
        if (!res.ok) {
          // 🛡️ FIX-SILENT: الفشل كيتسجل — "catch بلا صمت" (فلسفة المشروع)
          console.warn('HeroSection: HTTP', res.status, '— fallback to trending');
          return;
        }
        const data = await res.json();
        // 🛡️ FIX-GUARD: كل فرع متحقق من نوعه — truthy غير-array كان يطيح فـ .slice بصمت
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.products) ? data.products
          : Array.isArray(data?.items) ? data.items
          : Array.isArray(data?.data) ? data.data
          : [];
        if (list.length > 0) setProducts(list.slice(0, 12));
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.warn('HeroSection: fetch failed', err);
      }
    };
    fetchProducts();
    return () => controller.abort();
  }, [heroPage, API_URL]);

  // ✨ كيسدّ البطاقة الموسعة ملي كنضغطو خارجها
  useEffect(() => {
    if (activeCard === null) return;
    const handleOutside = (e: Event) => {
      if (cardsRef.current && !cardsRef.current.contains(e.target as Node)) {
        setActiveCard(null);
      }
    };
    document.addEventListener('click', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('click', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [activeCard]);

  // 🛡️ FIX-RACE (gsap) — النسخة المكففة:
  //   1) حرس عالمي: StrictMode/remount = init واحد فقط (كانو جوج tweens لانهائيين كيتحاربو)
  //   2) gsap حرج: poll ≤5s — السيناريو "ScrollTrigger وصل قبل gsap" ما عاد كيقتل الأنيميشن
  //   3) ScrollTrigger اختياري: إلا ما وصلش مع الأولى، تعلّق متأخر ≤10s وكيزيد غير الـ scroll-fade
  //   4) بلا gsap نهائيًا (CDN محجوب): المحتوى كامل ظاهر بلا أنيميشن — تدهور رشيق
  const initGSAP = () => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__laclarcHeroGsap) return;
    w.__laclarcHeroGsap = true; // الحرس أول حاجة — هذا كيحمي حتى من الاستدعاءات المتوازية

    let gsapTries = 0;
    const tryInit = () => {
      if (!w.gsap) {
        if (++gsapTries < 50) setTimeout(tryInit, 100); // أقصى ~5s
        // انتهى المهلة بلا gsap — المحتوى ظاهر، ما كاين ما يتدار (تدهور رشيق موثق)
        return;
      }

      const tl = w.gsap.timeline();
      tl.from('.gsap-hero', { y: 25, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' })
        .from('.gsap-parallax-img', { scale: 0.9, opacity: 0, duration: 1.2, ease: 'power2.out' }, '-=0.5');

      w.gsap.to('.float-anim-slow', { y: '-=12', duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      w.gsap.to('.float-anim', { y: '-=8', duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });

      attachScrollFade();
    };

    const attachScrollFade = () => {
      if (w.ScrollTrigger) {
        w.gsap.registerPlugin(w.ScrollTrigger);
        w.gsap.to('.hero-container', {
          opacity: 0.3, scale: 0.98, ease: 'none',
          scrollTrigger: { trigger: '.hero-container', start: 'top top', end: 'bottom top', scrub: 1 },
        });
        return;
      }
      // ScrollTrigger مازال ما وصل — تعلّق متأخر بحدود 10s (33 محاولة × 300ms)
      let stTries = 0;
      const late = setInterval(() => {
        if (w.ScrollTrigger && w.gsap) {
          clearInterval(late);
          w.gsap.registerPlugin(w.ScrollTrigger);
          w.gsap.to('.hero-container', {
            opacity: 0.3, scale: 0.98, ease: 'none',
            scrollTrigger: { trigger: '.hero-container', start: 'top top', end: 'bottom top', scrub: 1 },
          });
        } else if (++stTries > 33) {
          clearInterval(late); // ScrollTrigger ما جاش — الأنيميشن الأساسي خدام بلا الـ scroll-fade
        }
      }, 300);
    };

    tryInit();
  };

  // ✨ Seeded Fisher-Yates (mulberry32 — نفس PRNG ديال الكتالوغ) — ترتيب حتمي لنفس الـ seed
  const rotated = useMemo(() => {
    const pool = products.length > 0 ? products : (trendingProducts || []);
    if (shuffleSeed === null || pool.length <= 3) return pool.slice(0, 3);

    const list = [...pool];
    let seed = shuffleSeed;
    const rand = () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, 3);
  }, [products, trendingProducts, shuffleSeed]);

  const cards = rotated.length > 0 ? rotated : [];

  const positions = ['pos-top', 'pos-bottom-left', 'pos-bottom-right'];
  const countClass = cards.length === 1 ? 'count-1' : cards.length === 2 ? 'count-2' : '';

  const getImage = (p: any) => IMG.card(p?.image_url || p?.image || p?.thumbnail || '/icon-192.png');
  const formatPrice = (p: any) => {
    const val = Number(p?.price);
    return isNaN(val) ? p?.price : `$${val.toFixed(2)}`;
  };

  // ✨ أول ضغطة = توسيع | ضغطة ثانية = دخول للمنتج
  const handleCardTap = (e: React.MouseEvent<HTMLAnchorElement>, index: number) => {
    if (activeCard !== index) {
      e.preventDefault();
      setActiveCard(index);
    } else {
      setActiveCard(null);
    }
  };

  // ✨ v2: وصف صادق من DB (category حقيقي) — بلا "limited stock" مزيف
  const getHonestDescription = (p: any) => {
    if (p?.category) {
      const leaf = String(p.category).split('/').pop()?.replace(/-/g, ' ');
      if (leaf) return `${leaf} — ships FREE worldwide`;
    }
    return 'Curated quality — free worldwide shipping';
  };

  return (
    <div className="w-full font-sans text-[#22364A] overflow-hidden bg-[#F7FAFC] rounded-none md:rounded-3xl mb-0 md:mb-8 border-b md:border border-gray-200/80 shadow-xl">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="afterInteractive" onLoad={initGSAP} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" strategy="afterInteractive" onLoad={initGSAP} />

      <section className="hero-container relative min-h-[90vh] md:min-h-[85vh] lg:min-h-[92vh] w-full flex flex-col justify-between p-6 sm:p-12 lg:p-16 overflow-hidden">

        <div className="gsap-bg-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] font-black leading-none select-none pointer-events-none text-[#5B7EA6]/[0.08] tracking-tighter whitespace-nowrap z-0 hidden md:block">
          LACLARC
        </div>

        {/* رأس الصفحة */}
        <div className="relative z-20 flex justify-between items-center w-full gap-2">
          <div className="float-anim gsap-hero flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full border-2 border-[#E2836B] overflow-hidden shrink-0 shadow-lg shadow-[#E2836B]/25">
              <Image
                src="/icon-192.png"
                alt="Laclarc Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover mix-blend-multiply"
                priority
              />
            </div>
            <div className="text-[#22364A] min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider leading-none">Laclarc</h4>
              <span className="text-[9px] text-gray-500 uppercase">Enterprise</span>
            </div>
          </div>

          {/* الساعة */}
          <div className="gsap-hero shrink-0 bg-white/80 backdrop-blur-md border border-white/80 px-3 py-1.5 rounded-full text-emerald-600 text-[10px] font-mono font-bold flex items-center gap-1.5 whitespace-nowrap tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
            {isMounted ? liveTime : 'Live'}
          </div>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-8 mt-4 md:mt-0 lg:flex-row lg:justify-between">

          {/* بطاقات المنتجات — Collage مع دوّار الجلسة */}
          <div className="gsap-parallax-img relative w-full lg:w-1/2 flex items-center justify-center pointer-events-auto order-1 lg:order-2 py-2 lg:py-0">
            <div
              ref={cardsRef}
              className={`hero-cards-container float-anim-slow ${countClass}`}
            >
              {cards.length > 0 ? (
                cards.map((product: any, index: number) => (
                  <Link
                    key={product?.id ?? index}
                    href={`/products/${product.id}`}
                    className={`hero-card ${positions[index]} ${activeCard === index ? 'is-active' : ''}`}
                    onClick={(e) => handleCardTap(e, index)}
                    aria-expanded={activeCard === index}
                  >
                    <img
                      src={index === 0 ? IMG.detail(getImage(product)) : IMG.card(getImage(product))}
                      alt=""
                      fetchPriority={index === 0 ? 'high' : undefined}
                      decoding="async"
                      className="hero-card-img"
                      aria-hidden="true"
                    />
                    <div className="hero-card-content">
                      <div className="hero-card-title">
                        {product?.title || 'Laclarc Premium'}
                      </div>
                      {product?.price && (
                        <div className="hero-card-price">{formatPrice(product)}</div>
                      )}
                      <div className="hero-card-description">
                        {getHonestDescription(product)}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div
                  className="hero-card pos-top"
                  style={{
                    backgroundImage: 'url(/icon-192.png)',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: 'white'
                  }}
                >
                  <div className="hero-card-content">
                    <div className="hero-card-title">Laclarc Premium Collection</div>
                    <div className="hero-card-description">
                      Trending deals across all departments.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* النصوص والأزرار */}
          <div className="max-w-xl space-y-6 text-center lg:text-left z-20 lg:w-1/2 order-2 lg:order-1">
            <div className="gsap-hero inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#5B7EA6]/15 border border-[#5B7EA6]/30 text-[#5B7EA6] text-[10px] font-black uppercase tracking-wider">
              Exclusive Premium Deals
            </div>

            <h1 className="gsap-hero text-3xl sm:text-4xl lg:text-6xl font-black text-[#22364A] tracking-tight leading-[1.1]">
              Engineered for <br />
              <span className="bg-linear-to-r from-[#5B7EA6] to-[#E2836B] bg-clip-text text-transparent">precision &amp; lifestyle.</span>
            </h1>

            <div className="gsap-hero flex items-center gap-3 flex-wrap pt-2 justify-center lg:justify-start">
              <Link
                href="#catalog"
                className="bg-[#22364A] hover:bg-[#33475C] text-white px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-xl shadow-[#22364A]/20 active:scale-95 flex items-center gap-2 border border-white/10"
              >
                Shop Trending Deals
                <span className="w-5 h-5 bg-[#E2836B] rounded-full flex items-center justify-center text-[10px] text-white"><GlassIcon i="zap" size="xs" /></span>
              </Link>

              <Link
                href="/categories"
                className="bg-white hover:bg-gray-50 text-[#22364A] border border-[#5B7EA6]/30 px-5 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                All Departments
              </Link>
            </div>
          </div>
        </div>

        {/* الشريط السفلي — 🧹 3 spans خاويين تحيدو (كانو كيرندرو والو) */}
        <div className="relative z-20 w-full pt-8 pb-4 border-t border-gray-200/60 flex justify-between items-center text-[10px] font-bold text-gray-400 flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            100% Buyer Protection
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            Direct Automated Logistics
          </span>
          <span className="flex items-center gap-1.5">
            Bank-Grade Security
          </span>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="bg-white p-8 sm:p-14 border-t border-gray-200 relative z-20">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
            <div className="space-y-3 max-w-sm">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#5B7EA6]">
                <span className="w-2 h-2 rounded-full bg-[#E2836B]"></span>
                The Laclarc Standard
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Insured Worldwide Shipping across USA, Europe, Africa, and Gulf regions with real-time live tracking.
              </p>
            </div>
            <div className="max-w-xl space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#22364A] leading-snug">
                Premium curated quality meets accessibility:<br />
                <span className="text-[#5B7EA6]">Speed, style, and </span> excellence without compromise.
              </h2>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}