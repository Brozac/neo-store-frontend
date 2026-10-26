'use client';

/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc ProductCard — v5.0 (HOMECARD Task 18 + GLASSCARD Task 20)
 * ═══════════════════════════════════════════════════════════════
 * ✨ [glasscard] — بانل الزجاج تاع mockup المستخدم (نفس وصفة Task 19
 *    تاع بطاقات hero = لغة موحّدة):
 *    · ديسكتوب (hover+mouse): صورة نقيّة في الراحة + سعر + سواتشات،
 *      وعلى hover/is-active/focus-within بانل زجاجي كيطلع من لتحت
 *      (.4s ease-in + blur 15px + border-top بيضاء) فيه العنوان
 *      uppercase + سطر القسم + أيقونات (👁 Quick View / 🛒 Add)
 *      بدخول متدرج calc(0.12s + 0.15s × i) — بلاصة pills السفلية
 *      (اللي كيتخباو في الديسكتوب)
 *    · موبايل/لمس: البانل display:none — تصميم HOMECARD كيما هو
 *      (scrim + عنوان + سطر القسم + pills) — صفر تغيير
 *    · CSS كامل في ProductCardGlass.css (كومبوننت CSS بعد globals —
 *      globals.css ما تلمسش)
 * ───────────────────────────────────────────────────────────────
 * ✨ [frameless] — Task 21: «نح كارت أبيض، خلي المنتج كامل في بلاصتو،
 *    حاجة ماتحدو» — الكتالوج المفتوح:
 *    · الكارت الأبيض تحيّد (bg-white + ظل + radius) — بلاصة الصورة كاملة
 *      edge-to-edge: بلا هوامش داخلية (p-3→0) وبلا بئر بتدرج ولا حواف
 *    · النصوص (قسم/سعر/سواتشات/pills) على خلفية الصفحة مباشرة
 *    · التوهج البنفسجي القديم تاع hover في globals (product-card-animated
 *      من عصر Aurora) تنقّى في ProductCardGlass.css — صفر حاجة ترسم
 *      إطار حول المنتج (الرفعة translateY(-4px) كتبقى = لمسة تفاعلية)
 *    · [glasscard] القلب/البانل الزجاجي/الـ QV modal كيما هوما
 * ───────────────────────────────────────────────────────────────
 * ✨ [homecard] — تصميم بطاقة المنتج من mockup المستخدم (صفحة رئيسية):
 *    · كارت أبيض بحواف كبيرة (20px) بلا حدود + ظل ضبابي ناعم
 *    · بئر صورة مدوّر بتدرج fog ناعم (توكنات حية = SERENE V2)
 *    · الاسم فوق الصورة بأبيض + scrim حبري متدرج (كما في mockup)
 *    · ❤️ قلب زجاجي (glassbtn) = مفضلة حقيقية — نفس آلية localStorage
 *      'favorites' تاع صفحة المنتج/favorites (parse-safe + cap 100)
 *      + نبضة pop بـ WAAPI (احترام prefers-reduced-motion)
 *    · سطر القسم الحقيقي (من category) في خانة الوصف — الـ API تاع
 *      اللائحة ما يرجعش description/rating → صفر بيانات مفبركة
 *    · سعر حبري غامق + سعر قديم مشطوب + pill الخصم الوردية
 *      (TRUST FIX محفوظ: الخصم من original_price الحقيقي فقط 1–89%)
 *    · زوج أزرار pill: Add to Cart غامق + Quick View مفرغ
 *      → Quick View = مودال حقيقي (Portal): bottom-sheet في الهاتف /
 *        بطاقة وسط الشاشة في الديسكتوب — صورة + سعر + إضافة للسلة
 *    · [card-swatches v4] حلقة الاختيار = نمط mockup: 0 0 0 2px #fff
 *      + 0 0 0 4px var(--color-fog-500) — كتتأقلم مع الباليت الحية
 * ───────────────────────────────────────────────────────────────
 * محفوظ كما هو (الجولات السابقة):
 * 🔹 FIX-IMG — IMG.card() (OSS transform 400w ~15KB بدل 259KB خام)
 * 🔹 FIX-LAZY — loading="lazy" + decoding="async" + eager اختياري (LCP)
 * 🔹 FIX-LINK — Link حقيقي: new-tab / keyboard / SEO / prefetch={false}
 * 🔹 FIX-SILENT — catch بلا صوت ممنوع → console.error ينجو من removeConsole
 * 🔹 FIX-ZERO — سعر مفقود ما يعرضش "$0.00" → الصف يختفي
 * 🔹 FIX-VID — quick-add كيصيفط vid تاع اللون المختار/المعاين
 * 🔹 TRUST FIX — خصم من original_price الحقيقي فقط (1–89%)
 * 🔹 isTouched/is-active · aspect-square = صفر CLS · data-product-id
 *    (نظام is-touched تاع HomeClient/favorites كيقراهم — ما تبدلوش)
 * ───────────────────────────────────────────────────────────────
 * ⚠️ تذكير أمني: السعر هنا للعرض/السلة فقط. إعادة التسعير server-side
 *    إلزامية في checkout (server.js) قبل أي PaymentIntent.
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { IMG } from '../../lib/imageOptimizer';
import GlassIcon from '@/components/ui/GlassIcon';
// ✨ [glasscard] — بانل الزجاج (hover) — component CSS كيتحمّل بعد globals
import './ProductCardGlass.css';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image?: string;
  image_url?: string;
  description?: string;
  rating?: number;
  sales_count?: number;
  discount?: string;
  /** ✨ [homecard] — القسم الحقيقي (خانة الوصف تاع البطاقة ببيانات حقيقية) */
  category?: string;
  variants?: any[];
  /** ✨ [card-swatches] — من الباك (Kit 30): {c: اسم اللون, i: صورة الـ variant, v: vid} */
  swatches?: { c: string; i: string; v?: string }[];
  /** ✨ [card-swatches] — عدد الألوان الزايدة فوق الـ 5 المعروضين */
  swMore?: number;
}

interface ProductCardProps {
  product: Product;
  isTouched?: boolean;
  /** 🩹 FIX-LAZY: true = eager للصورة (أول كروت أول شاشة — مرشحو LCP) */
  eager?: boolean;
  /** ✨ [masonry] نتائج Google (طلب المستخدم): بئر الصورة يولي بطول متغير
   *    لكل منتج (نسبة ثابتة من hash ديال id) + object-cover — موبايل برك */
  masonry?: boolean;
}

// ✨ [masonry] — «كل صورة بطول مختلف، بحال نتائج بحث Google» (F#30-masonry):
//    طقم نسب مدروس (مربع ↔ بورتريه، 2/3 نادر) — القص مع object-cover يبقى
//    في الهوامش البيض تاع صور CJ (المنتج في الوسط = ما يتقصش).
//    · النسبة ثابتة لكل منتج (hash ديال id) → SSR = hydration صفر mismatch،
//      والمنتج كيبقى بنفس الشكل في كل زيارة (ما كاينش رجعة ولا قفزات).
//    · aspectRatio inline style = صفر خطر purge من Tailwind + صفر CLS
//      (الارتفاع معروف قبل ما تتحمل الصورة — نفس حماية aspect-square).
const MASONRY_RATIOS = ['4 / 5', '1 / 1', '3 / 4', '5 / 6', '1 / 1', '3 / 4', '4 / 5', '2 / 3'];
const masonryRatio = (id: string | number): string => {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return MASONRY_RATIOS[Math.abs(h) % MASONRY_RATIOS.length];
};

// 🛡️ [homecard] قراءة المفضلة parse-safe — localStorage فاسد ما يكسرش القلب
//    (نفس نمط ProductDetailsClient) + cap 100 = مطابق لـ by-ids LIMIT 100
const parseFavorites = (): string[] => {
  try {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    return Array.isArray(favs) ? favs.map(String).slice(0, 100) : [];
  } catch (e) {
    console.warn('[ProductCard] favorites: corrupted localStorage — reset', e);
    return [];
  }
};

// 🎬 [homecard] نبضة القلب (pop) — WAAPI بلا CSS keyframes (صفر لمسة على globals.css)
const popHeart = (el: Element | null) => {
  if (!el || typeof el.animate !== 'function') return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }],
      { duration: 340, easing: 'cubic-bezier(.34,1.56,.64,1)' }
    );
  } catch { /* بيئة بلا WAAPI — التنقل يبقى خدام */ }
};

export default function ProductCard({ product, isTouched, eager = false, masonry = false }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);
  // ✨ [card-swatches] — hover = معاينة مؤقتة · click = اختيار مثبت (موبايل)
  const [swHover, setSwHover] = useState(-1);
  const [swSel, setSwSel] = useState(-1);
  // ✨ [homecard] — القلب الزجاجي (مفضلة) + مودال Quick View
  const [fav, setFav] = useState(false);
  const [qvOpen, setQvOpen] = useState(false);
  const [qvShown, setQvShown] = useState(false);

  const handleCardClick = () => {
    router.push(`/products/${product.id}`);
  };

  // ✨ [homecard] — حالة القلب من التخزين (كل تغيير فـ id كيتعاود القراء)
  useEffect(() => {
    setFav(parseFavorites().includes(String(product.id)));
  }, [product.id]);

  // ✨ [homecard] — مودال QV: Esc + قفل تمرير الخلفية (تنظيف كامل عند الإغلاق)
  useEffect(() => {
    if (!qvOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeQV(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qvOpen]);

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const idStr = String(product.id);
    const favorites = parseFavorites();
    const turningOn = !favorites.includes(idStr);
    const newFavorites = turningOn
      ? [...favorites, idStr]
      : favorites.filter((f) => f !== idStr);
    try {
      localStorage.setItem('favorites', JSON.stringify(newFavorites.slice(0, 100)));
    } catch (err) {
      // 🩹 FIX-SILENT — Tenet: catch بلا صوت ممنوع
      console.error(`[ProductCard] favorites write failed (product ${idStr})`, err);
    }
    setFav(turningOn);
    if (turningOn) popHeart(document.querySelector(`[data-product-id="${idStr}"] [data-heart-svg]`));
  };

  const openQV = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQvOpen(true);
    // frame مزدوج = الترانزيشن يدخل من الحالة الابتدائية بلا قفزة (نفس نمط المودالات)
    requestAnimationFrame(() => requestAnimationFrame(() => setQvShown(true)));
  };

  const closeQV = () => {
    setQvShown(false);
    setTimeout(() => setQvOpen(false), 220);
  };

  // ✨ [card-swatches] — قائمة السواتشات الصالحة (≥2 باش الصف يظهر — لون واحد ما كيحتاجش سواتش)
  const swList = Array.isArray(product.swatches)
    ? product.swatches.filter((s) => s && typeof s.i === 'string' && s.i)
    : [];
  const hasSwatches = swList.length >= 2;
  const activeIdx = swHover >= 0 ? swHover : swSel;
  const activeSw = hasSwatches && activeIdx >= 0 && activeIdx < swList.length ? swList[activeIdx] : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // 🩹 [card-swatches] FIX-VID — الأولوية للـ vid تاع اللون المختار/المعاين
    //    (كان كيصيفط '' دايماً من اللائحة — الباك كان يوقع على أول variant بلا اختيار)
    let defaultVid = '';
    if (activeSw?.v) {
      defaultVid = activeSw.v;
    } else if (product.variants) {
      try {
        const v = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
        if (Array.isArray(v) && v[0]?.vid) defaultVid = v[0].vid;
      } catch (err) {
        // 🩹 FIX-SILENT — Tenet: catch بلا صوت ممنوع. error-level ينجو من removeConsole
        console.error(`[ProductCard] variants JSON parse failed (product ${product.id})`, err);
      }
    }

    addToCart({
      id: product.id,
      title: product.title,
      price: Number(product.price) || 0,
      quantity: 1,
      image: product.image || product.image_url || '/placeholder.jpg',
      image_url: product.image_url || product.image || '/placeholder.jpg',
      vid: defaultVid
    }, 1);

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const safePrice = Number(product.price) || 0;

  // 🩹 TRUST FIX — discount من original_price الحقيقي فقط (CJ) — صفر خصومات مفبركة:
  //    النسبة تُحسب من original_price الحقيقي فقط، والحبة تظهر فقط عند خصم حقيقي معقول (1-89%)
  let displayOriginalPrice = Number(product.original_price) || 0;
  let discountText = '';

  if (displayOriginalPrice > safePrice) {
    const disc = Math.round(((displayOriginalPrice - safePrice) / displayOriginalPrice) * 100);
    if (disc > 0 && disc < 90) {
      discountText = `-${disc}%`;
    } else {
      displayOriginalPrice = 0;
    }
  }

  // 🩹 FIX-IMG — OSS transform 400w (~15KB) — ✨ [card-swatches]: المعاينة كتبدل الصورة
  //    لصورة الـ variant المختار (نفس الـ transform → نفس الأداء) — والمودال كياخد نفس src
  const imgSrc = IMG.card(activeSw?.i || product.image_url || product.image || '/placeholder.jpg');

  // ✨ [masonry] — النسبة الخاصة بهاد المنتج (null = الوضع العادي aspect-square)
  const ratio = masonry ? masonryRatio(product.id) : null;

  const productUrl = `/products/${product.id}`;

  // ✨ [homecard] — سطر القسم الحقيقي (خانة الوصف تاع mockup ببيانات حقيقية):
  //    "sports-and-outdoors/swimming/two-piece-suits" → "Swimming · Two Piece Suits"
  const catLine = (() => {
    const segs = (product.category || '').split('/').filter(Boolean);
    if (segs.length === 0) return '';
    return segs.slice(-2)
      .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()))
      .join(' · ');
  })();

  return (
    <div
      data-product-id={String(product.id)}
      className={`product-card-wrapper product-card-animated overflow-hidden flex flex-col group relative cursor-pointer transition-transform duration-300 active:scale-[0.98] ${
        isTouched ? 'is-active' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* 🩹 FIX-LINK — Link حقيقي: new-tab / keyboard / SEO.
          stopPropagation يمنع التنفيذ المزدوج (Link يتكفل بالتنقل + div onClick) */}
      <Link
        href={productUrl}
        prefetch={false}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        {/* ✨ [homecard] بئر الصورة المدوّر — تدرج fog ناعم كيما mockup (توكنات حية)
            ✨ [frameless] البئر تحيّد: بلا هوامش ولا حواف ولا تدرج —
            الصورة edge-to-edge كاملة في بلاصتها، حاجة ما تحدّها */}
        <div
          className={`relative overflow-hidden ${masonry ? '' : 'aspect-square'}`}
          style={ratio ? { aspectRatio: ratio } : undefined}
        >
          {/* ✨ img — 🩹 FIX-IMG (OSS transform) + 🩹 FIX-LAZY (lazy/async + eager اختياري)
              ✨ [card-swatches]: activeSw?.i = صورة اللون المختار (نفس OSS transform)
              ✨ [frameless] p-3 تحيّد — المنتج كامل في بلاصتو */}
          <img
            src={imgSrc}
            alt={product.title || 'Product'}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className={`${masonry ? 'object-cover' : 'object-contain'} w-full h-full transition-transform duration-500 group-hover:scale-105`}
          />
          {/* ✨ [homecard] scrim حبري — الاسم الأبيض يقرا على أي صورة (كما في mockup)
              ✨ [glasscard] pc-scrim = مخبي في الديسكتوب (البانل الزجاجي عوضو) */}
          <div
            aria-hidden="true"
            className="pc-scrim absolute inset-x-0 bottom-0 h-[48%] pointer-events-none [background:linear-gradient(to_top,rgba(46,64,87,.84)_0%,rgba(46,64,87,.34)_42%,rgba(46,64,87,0)_72%)]"
          />
          <h3 className="pc-imgtitle absolute inset-x-0 bottom-0 px-3 pb-2.5 text-[12.5px] leading-[1.35] font-extrabold text-white line-clamp-2 pointer-events-none [text-shadow:0_1px_10px_rgba(23,37,54,.25)]">
            {product.title}
          </h3>

          {/* ✨ [glasscard] بانل الزجاج — mockup hover (ديسكتوب برك):
              كيطلع من لتحت .4s ease-in + blur 15px + دخول متدرج
              title → قسم → أيقونات calc(0.12s + 0.15s × i).
              داخل الـ well (overflow-hidden كيقصّو وهو مخبي للتحت).
              الأزرار داخل الـ Link = نفس نمط HeroSection (preventDefault
              في openQV/handleAddToCart كيمنع التنقل المزدوج) */}
          <div className="pc-glass">
            <p className="pc-gtitle">{product.title}</p>
            {catLine && <p className="pc-gcat">{catLine}</p>}
            <div className="pc-gicons">
              <span className="pc-gslot" style={{ '--i': 0 } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={openQV}
                  aria-haspopup="dialog"
                  aria-label="Quick view"
                  className="pc-gicon"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </span>
              <span className="pc-gslot" style={{ '--i': 1 } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  aria-live="polite"
                  aria-label={isAdded ? 'Added to cart' : 'Add to cart'}
                  className={`pc-gicon${isAdded ? ' is-added' : ''}`}
                >
                  {isAdded ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  )}
                </button>
              </span>
            </div>
          </div>
        </div>

        {/* ✨ [homecard] الجسم — سطر القسم + صف السعر (بلا نجوم: الـ API ما فيهش rating)
            ✨ [glasscard] pc-body/pc-bodycat = تنفس سفلي + اخفاء القسم في الديسكتوب
            (ولّى في البانل الزجاجي) — السعر باقي ظاهر دايماً */}
        <div className="pc-body px-3 pt-2.5 pb-0.5">
          {catLine && (
            <p className="pc-bodycat text-[9.5px] text-temu-gray-text font-semibold tracking-[0.02em] truncate">
              {catLine}
            </p>
          )}

          {/* 🩹 FIX-ZERO — بلا سعر حقيقي ما كاينش "$0.00" */}
          {safePrice > 0 && (
            <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
              <span className="text-[15.5px] font-black text-temu-black leading-none">
                ${safePrice.toFixed(2)}
              </span>
              {displayOriginalPrice > safePrice && (
                <span className="text-[10px] text-temu-gray-light line-through font-medium">
                  ${displayOriginalPrice.toFixed(2)}
                </span>
              )}
              {discountText && (
                <span className="text-[9px] font-black px-2 py-[3px] rounded-full bg-coral-500/15 text-coral-600 leading-none">
                  {discountText}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* ✨ [homecard] القلب الزجاجي — خارج الـ Link (تفاعل مستقل، بلا تداخل interactive)
          toggle حقيقي على localStorage 'favorites' — نفس الآلية تاع صفحة المنتج */}
      <button
        type="button"
        data-heart-btn
        aria-label={fav ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={fav}
        onClick={toggleFav}
        className={`absolute top-4 right-4 z-10 w-7 h-7 rounded-full bg-white/85 backdrop-blur-md shadow-[0_4px_14px_rgba(46,64,87,.16)] flex items-center justify-center cursor-pointer transition-colors duration-200 active:scale-90 ${
          fav ? 'text-coral-500' : 'text-temu-black'
        }`}
      >
        <svg data-heart-svg width="14" height="14" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* ✨ [card-swatches] — صف السواتشات: خارج الـ Link (كليك ما كيبدلش الصفحة)
          stopPropagation يمنع card onClick · hover=معاينة · click=تثبيت
          ✨ [homecard] حلقة الاختيار = نمط mockup (2px أبيض + 4px fog-500) */}
      {hasSwatches && (
        <div
          className="pc-swatches px-3 pt-1.5 pb-1 flex items-center gap-1.5 flex-wrap"
          onMouseLeave={() => setSwHover(-1)}
        >
          {swList.map((s, idx) => (
            <button
              key={`${s.c || 'sw'}-${idx}`}
              type="button"
              title={s.c || 'Color'}
              aria-label={`Color: ${s.c || 'option'}${swSel === idx ? ' (selected)' : ''}`}
              aria-pressed={swSel === idx}
              onMouseEnter={() => setSwHover(idx)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSwSel((prev) => (prev === idx ? -1 : idx));
              }}
              className={`w-5 h-5 rounded-full overflow-hidden border-2 border-transparent transition-all duration-150 cursor-pointer p-0 ${
                activeIdx === idx
                  ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-fog-500)]'
                  : 'border-temu-gray-border-light hover:border-temu-gray-light'
              }`}
            >
              <img
                src={IMG.thumb(s.i)}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {typeof product.swMore === 'number' && product.swMore > 0 && (
            <span className="text-[10px] font-bold text-temu-gray-light leading-none">+{product.swMore}</span>
          )}
          {activeSw?.c && (
            <span className="text-[10px] text-temu-gray-light truncate max-w-[90px] leading-none">
              {activeSw.c}
            </span>
          )}
        </div>
      )}

      {/* ✨ [homecard] زوج الأزرار pill — Add غامق + Quick View مفرغ (كما في mockup)
          ✨ [glasscard] pc-pills = مخبي في الديسكتوب (أيقونات البانل عوضاتو) —
          موبايل كيما هو */}
      <div className="pc-pills p-3 pt-2 mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddToCart}
          aria-live="polite"
          className={`h-[34px] flex-[1.35] rounded-full text-white text-[10.5px] font-extrabold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${
            isAdded ? 'bg-maroccan-tea-600' : 'bg-temu-black'
          }`}
        >
          {isAdded ? (
            <>
              <span><GlassIcon i="check" size="xs" /></span> Added
            </>
          ) : (
            'Add to Cart'
          )}
        </button>
        <button
          type="button"
          onClick={openQV}
          aria-haspopup="dialog"
          className="h-[34px] flex-1 rounded-full border border-temu-gray-border bg-white text-temu-gray-text text-[10.5px] font-bold flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 hover:border-temu-gray-light hover:text-temu-black"
        >
          Quick View
        </button>
      </div>

      {/* ✨ [homecard] مودال Quick View — Portal للـ body (يعلو على will-change:transform
          تاع product-card-animated اللي كان غادي يحبس fixed داخل الكارت) */}
      {qvOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9990]" role="dialog" aria-modal="true" aria-label={`Quick view: ${product.title || 'Product'}`}>
          {/* الخلفية — كليك = إغلاق */}
          <div
            onClick={closeQV}
            className={`absolute inset-0 bg-[rgba(35,52,74,.45)] backdrop-blur-[6px] transition-opacity duration-200 ${qvShown ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* الشيت — bottom-sheet في الهاتف · بطاقة وسط الشاشة في الديسكتوب */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[400px] w-full sm:rounded-[22px] rounded-t-[22px] bg-white p-4 pb-[calc(1.1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(35,52,74,.28)] transition-all duration-[240ms] ease-out ${qvShown ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-10 sm:translate-y-0 sm:scale-95'}`}
          >
            <button
              type="button"
              autoFocus
              aria-label="Close quick view"
              onClick={closeQV}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-temu-offwhite text-temu-gray-text flex items-center justify-center cursor-pointer transition-colors hover:text-temu-black"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="flex gap-3.5">
              {/* نفس imgSrc تاع الكارت — اختيار السواتش كيبان حتى هنا */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-[16px] overflow-hidden [background:linear-gradient(165deg,#ffffff_0%,var(--color-temu-offwhite)_48%,var(--color-fog-100)_100%)]">
                <img src={imgSrc} alt={product.title || 'Product'} className="w-full h-full object-contain p-2" />
              </div>
              <div className="min-w-0 flex-1 pr-7">
                <h3 className="text-[14px] font-extrabold text-temu-black leading-snug line-clamp-2">
                  {product.title}
                </h3>
                {catLine && (
                  <p className="text-[10px] text-temu-gray-text font-semibold mt-1 truncate">{catLine}</p>
                )}
                {/* 🩹 FIX-ZERO + TRUST FIX — نفس صداقة السعر تاع الكارت */}
                {safePrice > 0 && (
                  <div className="flex items-baseline gap-2 mt-2.5 flex-wrap">
                    <span className="text-[19px] font-black text-temu-black leading-none">
                      ${safePrice.toFixed(2)}
                    </span>
                    {displayOriginalPrice > safePrice && (
                      <span className="text-[11px] text-temu-gray-light line-through font-medium">
                        ${displayOriginalPrice.toFixed(2)}
                      </span>
                    )}
                    {discountText && (
                      <span className="text-[9.5px] font-black px-2 py-[3px] rounded-full bg-coral-500/15 text-coral-600 leading-none">
                        {discountText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* السواتشات في المودال — نفس الاختيار المشترك مع الكارت */}
            {hasSwatches && (
              <div
                className="mt-3.5 flex items-center gap-1.5 flex-wrap"
                onMouseLeave={() => setSwHover(-1)}
              >
                {swList.map((s, idx) => (
                  <button
                    key={`qv-${s.c || 'sw'}-${idx}`}
                    type="button"
                    title={s.c || 'Color'}
                    aria-label={`Color: ${s.c || 'option'}${swSel === idx ? ' (selected)' : ''}`}
                    aria-pressed={swSel === idx}
                    onMouseEnter={() => setSwHover(idx)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSwSel((prev) => (prev === idx ? -1 : idx));
                    }}
                    className={`w-6 h-6 rounded-full overflow-hidden border-2 border-transparent transition-all duration-150 cursor-pointer p-0 ${
                      activeIdx === idx
                        ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-fog-500)]'
                        : 'border-temu-gray-border-light hover:border-temu-gray-light'
                    }`}
                  >
                    <img src={IMG.thumb(s.i)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
                {activeSw?.c && (
                  <span className="text-[10px] text-temu-gray-light truncate max-w-[120px] leading-none ml-0.5">
                    {activeSw.c}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              className={`w-full h-[44px] mt-4 rounded-full text-white text-[13px] font-extrabold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                isAdded ? 'bg-maroccan-tea-600' : 'bg-temu-black'
              }`}
            >
              {isAdded ? (
                <>
                  <span><GlassIcon i="check" size="xs" /></span> Added to Cart
                </>
              ) : (
                'Add to Cart'
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeQV();
                router.push(productUrl);
              }}
              className="w-full h-[38px] mt-2 rounded-full border border-temu-gray-border bg-white text-temu-gray-text text-[12px] font-bold flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.97] hover:border-temu-gray-light hover:text-temu-black"
            >
              View Full Details
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
