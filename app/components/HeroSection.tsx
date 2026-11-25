'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { IMG } from '@/lib/imageOptimizer';
import GlassIcon from '@/components/ui/GlassIcon';

// ══════════════════════════════════════════════════════════════════
// HeroSection v3 — Polaroid Stack (طلب المالك 2026-11-25)
//
// 🎴 بطاقات عرض المنتجات فقط هي اللي تبدلت — كلشي آخر فالهيرو بقا كما هو:
//    الكولاج القديم (3 بطاقات بنص/سعر/توسّع عند المرّة) → ستاك polaroid
//    صور صافية بـ3 بطاقات. المقاسات الكبيرة = CSS المالك الأصلي (100px/78px)
//    ×2.4 + بطاقة ثالثة بنفس النسب (موثق فـ globals.css).
//    الكليك على البطاقة كيدي نيشان للمنتج — التوسّع تحيد (كان خاص الكولاج
//    اللي كان فيه نص يقرا).
//
// 🔄 ROTATE-V2 — توافق مع ROTATE-V1 ديال الهوم (HomeClient):
//    «المنتجات كل مرة يدخل زبون ويخرج كيتبدلو» — بلا sessionStorage ولا
//    قيم محفوظة: كل زيارة = صفحة عشوائية (1..50) + seed خلط عشوائي.
//    🛡️ SSR-safe: القيم العشوائية كتحسب داخل الـ effect بعد الـ hydration
//    (shuffleSeed يبقى null حتى التركيب باش أول رندر كلاينت يطابق السيرفر
//    بلا mismatch — نفس الحيلة الموثقة ديال v2).
//
// 🛡️ FIX-RACE (gsap): السكريبتات async — ما عندهمش ترتيب تنفيذ مضمون.
//    ScrollTrigger يقدر ينفذ قبل gsap → initGSAP كان يخرج بصمت = صفر
//    أنيميشن للأبد (نفس عائلة "الموت الصامت"). دابا: poll ≤5s لـ gsap
//    + ScrollTrigger اختياري بتعلّق متأخر ≤10s + حرس عالمي ضد التكرار.
// 🛡️ FIX-EDGE: floor+1 = مدى 1..50 مضمون (ceil كان يعطي 0 عند random()===0).
// 🛡️ FIX-SILENT: !res.ok ما بقاش صامت — console.warn بالـ status.
// 🛡️ FIX-GUARD: Array.isArray على كل فرع من فروع استخراج الـ list.
//
// 📱 الظهور: الهيرو كامل مخبي <640px (HomeClient: hidden sm:block — قرار
//    المالك 2026-11-06) — هاد المكون كيتشاف غير تابلت/كمبيوتر، وما تبدل والو.
//
// ⚠️ M#45 — ادعاءات تجارية بلا سند موثق (قرار المالك، ما تبدلتش):
//    "Insured Worldwide Shipping" · "real-time live tracking" ·
//    "ships FREE worldwide" · "100% Buyer Protection"
//    → توثيق أو تخفيف، نفس ملف القرار ديال wrapper الفئة.
// ══════════════════════════════════════════════════════════════════

interface HeroSectionProps {
  trendingProducts?: any[];
}

export default function HeroSection({ trendingProducts }: HeroSectionProps = {}) {
  const [liveTime, setLiveTime] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  // ✨ v3 (ROTATE-V2) — seed جديد في كل زيارة. init بـ null + effect ماشي
  //    lazy-init: مقصود — أول رندر كلاينت يطابق SSR (بلا hydration mismatch)
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);

  useEffect(() => {
    setShuffleSeed(Math.floor(Math.random() * 1_000_000));
  }, []);

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

  // 🔧 F107 — مسارات نسبية (Worker: proxy → db-ro) · <GlassIcon ch="✨" size="xs" /> Tenet #4 + fallback
  const API_URL = '';

  // 🔄 ROTATE-V2 — الصفحة عشوائية داخل الـ effect (بلا state ولا sessionStorage):
  //    كل زيارة كتجيب 12 منتج من صفحة مختلفة من الكتالوج → الخلط كياخد 3.
  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      try {
        const page = Math.floor(Math.random() * 50) + 1; // 🛡️ FIX-EDGE: 1..50 مضمون
        const res = await fetch(`${API_URL}/api/products?page=${page}&limit=12`, { signal: controller.signal });
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
  }, [API_URL]);

  // 🛡️ FIX-RACE (gsap) — النسخة المكففة (بقيت كما هي من v2.1):
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

  // ✨ Seeded Fisher-Yates (mulberry32 — نفس PRNG ديال الكتالوغ) — ترتيب حتمي لنفس الـ seed.
  //    v3: seed عشوائي كل زيارة (ROTATE-V2) → 3 بطاقات جديد كل مرة يدخل الزبون.
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

  const getImage = (p: any) => IMG.card(p?.image_url || p?.image || p?.thumbnail || '/icon-192.png');

  return (
    <div className="w-full font-sans text-[#2E4057] overflow-hidden bg-[#F4F8FB] rounded-none md:rounded-3xl mb-0 md:mb-8 border-b md:border border-gray-200/80 shadow-xl">
      {/* F#64 SRI — modern-web-guidance: scripts خارجية بلا integrity = سلسلة توريد مكشوفة
          لو cdnjs انخترقت، GSAP المزوّر كيخدم على laclarc.com كامل. الـ hashes محسوبة
          من الملف الأصلي بتاع cdnjs 3.12.2 (openssl dgst -sha384) — أي تعديل بايت واحد = حجب.
          ⚠️ cast as object: ScriptProps تاع next/script مازال ما يشملش integrity — الـ runtime
          كيفردهم كاملين للـ DOM عبر setAttributesFromProps (script.js:122) — الأنواع المتأخرة ماشي السلوك */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="afterInteractive" onLoad={initGSAP}
        {...({ integrity: 'sha384-d+vyQ0dYcymoP8ndq2hW7FGC50nqGdXUEgoOUGxbbkAJwZqL7h+jKN0GGgn9hFDS', crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' } as object)} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" strategy="afterInteractive" onLoad={initGSAP}
        {...({ integrity: 'sha384-poC0r6usQOX2Ayt/VGA+t81H6V3iN9L+Irz9iO8o+s0X20tLpzc9DOOtnKxhaQSE', crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' } as object)} />

      <section className="hero-container relative min-h-[90vh] md:min-h-[85vh] lg:min-h-[92vh] w-full flex flex-col justify-between p-6 sm:p-12 lg:p-16 overflow-hidden">

        <div className="gsap-bg-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] font-black leading-none select-none pointer-events-none text-[#5B7EA6]/[0.08] tracking-tighter whitespace-nowrap z-0 hidden md:block">
          LACLARC
        </div>

        {/* رأس الصفحة */}
        <div className="relative z-20 flex justify-between items-center w-full gap-2">
          <div className="float-anim gsap-hero flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full border-2 border-[#7FA1C4] overflow-hidden shrink-0 shadow-lg shadow-[#7FA1C4]/25">
              <Image
                src="/icon-192.png"
                alt="Laclarc Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover mix-blend-multiply"
                priority
              />
            </div>
            <div className="text-[#2E4057] min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider leading-none">Laclarc</h4>
              <span className="text-[9px] text-gray-500 uppercase">Enterprise</span>
            </div>
          </div>

          {/* الساعة */}
          <div className="gsap-hero shrink-0 bg-white/80 backdrop-blur-md border border-white/80 px-3 py-1.5 rounded-full text-maroccan-tea-600 text-[10px] font-mono font-bold flex items-center gap-1.5 whitespace-nowrap tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-maroccan-tea-500 animate-ping shrink-0"></span>
            {isMounted ? liveTime : 'Live'}
          </div>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-8 mt-4 md:mt-0 lg:flex-row lg:justify-between">

          {/* بطاقات المنتجات — 🎴 Polaroid stack (v3): صور صافية بلا نص · 3 بطاقات
              بالمقاسات الكبيرة (CSS المالك ×2.4) · كل زيارة كيتبدلو (ROTATE-V2).
              الكليك كيدي نيشان للمنتج — التوسّع تحيد (كان خاص الكولاج اللي فيه نص) */}
          <div className="gsap-parallax-img relative w-full lg:w-1/2 flex items-center justify-center pointer-events-auto order-1 lg:order-2 py-2 lg:py-0">
            <nav className="hero float-anim-slow" aria-label="Featured products">
              {cards.length > 0 ? (
                cards.map((product: any, index: number) => (
                  <Link
                    key={product?.id ?? index}
                    href={`/products/${product.id}`}
                    className="hero-img"
                    data-hero={index + 1}
                  >
                    <img
                      src={index === 0 ? IMG.detail(getImage(product)) : IMG.card(getImage(product))}
                      alt={product?.title || 'Laclarc product'}
                      fetchPriority={index === 0 ? 'high' : undefined}
                      decoding="async"
                    />
                  </Link>
                ))
              ) : (
                // 🖼️ أول طلعة (قبل ما توصل الداتا): فرامات باللوگو — نفس الستايل، بلا نص
                [1, 2, 3].map((n) => (
                  <span key={n} className="hero-img is-logo" data-hero={n} aria-hidden="true">
                    <img src="/error-bag.png" alt="" />
                  </span>
                ))
              )}
            </nav>
          </div>

          {/* النصوص والأزرار */}
          <div className="max-w-xl space-y-6 text-center lg:text-left z-20 lg:w-1/2 order-2 lg:order-1">
            <div className="gsap-hero inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#5B7EA6]/15 border border-[#5B7EA6]/30 text-[#5B7EA6] text-[10px] font-black uppercase tracking-wider">
              Exclusive Premium Deals
            </div>

            <h1 className="gsap-hero text-3xl sm:text-4xl lg:text-6xl font-black text-[#2E4057] tracking-tight leading-[1.1]">
              Engineered for <br />
              <span className="bg-linear-to-r from-[#5B7EA6] to-[#7FA1C4] bg-clip-text text-transparent">precision &amp; lifestyle.</span>
            </h1>

            <div className="gsap-hero flex items-center gap-3 flex-wrap pt-2 justify-center lg:justify-start">
              <Link
                href="#catalog"
                className="bg-[#2E4057] hover:bg-[#33475C] text-white px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-xl shadow-[#2E4057]/20 active:scale-95 flex items-center gap-2 border border-white/10"
              >
                Shop Trending Deals
                <span className="w-5 h-5 bg-[#7FA1C4] rounded-full flex items-center justify-center text-[10px] text-white"><GlassIcon i="zap" size="xs" /></span>
              </Link>

              <Link
                href="/categories"
                className="bg-white hover:bg-gray-50 text-[#2E4057] border border-[#5B7EA6]/30 px-5 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm active:scale-95"
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
                <span className="w-2 h-2 rounded-full bg-[#7FA1C4]"></span>
                The Laclarc Standard
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Insured Worldwide Shipping across USA, Europe, Africa, and Gulf regions with real-time live tracking.
              </p>
            </div>
            <div className="max-w-xl space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#2E4057] leading-snug">
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
