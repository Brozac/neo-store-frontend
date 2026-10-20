'use client';

/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc ProductCard — v3.1 (Kit 30 [card-swatches] · حلقة السواتش الداكنة)
 * ═══════════════════════════════════════════════════════════════
 * ✨ [card-swatches] — سواتشات الصور فالكارت (بأسلوب Temu):
 *    · swatches[] كتجي من الباك (Kit 30): لون + صورة variant + vid
 *      (المصدر: variants JSONB — variantKey بصيغة CJ الرسمية "Color-Size")
 *    · hover = معاينة الصورة بتاعة ذاك اللون · click = تثبيت الاختيار
 *    · 🩹 إصلاح حقيقي للـ quick-add: كان كيصيفط vid خاوي (اللائحة ما فيهاش
 *      variants) → دابا كيصيفط vid تاع اللون المختار/المعاين — نفس
 *      الحماية اللي في ProductDetailsClient (vid خاطئ = بضاعة خاطئة)
 *    · +N للألوان الزايدة · title/aria-label لكل سواتش · بلا CLS
 *    · [swatch-ring v3.1] حلقة الاختيار = temu-black (#1D1E3C) + ring-offset أبيض:
 *      السواتشات صور حقيقية فيها بنفسجي (مثال 28701 Purple) → حلقة بنفسجي
 *      كتخفي — الداكن المحايد كيتقرا على أي لون (بنترن Temu/Amazon/SHEIN)
 *      ويزال من نفس باليت الموقع · البنفسجي يبقى للـ CTA/الروابط/الأسعار
 *    · توافق خلفي 100%: بلا swatches فالپايلود → الصف مخبي (الكارت القديم)
 * ───────────────────────────────────────────────────────────────
 * محفوظ كما هو (v2.0 — Task 10 Review):
 * 🔹 FIX-IMG — IMG.card() (OSS transform 400w ~15KB بدل 259KB خام)
 * 🔹 FIX-LAZY — loading="lazy" + decoding="async" + eager اختياري (LCP)
 * 🔹 FIX-LINK — Link حقيقي: new-tab / keyboard / SEO / prefetch={false}
 * 🔹 FIX-SILENT — catch بلا صوت ممنوع → console.error ينجو من removeConsole
 * 🔹 FIX-ZERO — سعر مفقود ما يعرضش "$0.00" → الصف يختفي
 * 🔹 TRUST FIX — خصم من original_price الحقيقي فقط (1–89%)
 * 🔹 isTouched/is-active · aspect-square = صفر CLS
 * ───────────────────────────────────────────────────────────────
 * ⚠️ تذكير أمني: السعر هنا للعرض/السلة فقط. إعادة التسعير server-side
 *    إلزامية في checkout (server.js) قبل أي PaymentIntent.
 * ═══════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { IMG } from '../../../lib/imageOptimizer';
import GlassIcon from '@/components/ui/GlassIcon';

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
}

export default function ProductCard({ product, isTouched, eager = false }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);
  // ✨ [card-swatches] — hover = معاينة مؤقتة · click = اختيار مثبت (موبايل)
  const [swHover, setSwHover] = useState(-1);
  const [swSel, setSwSel] = useState(-1);

  const handleCardClick = () => {
    router.push(`/products/${product.id}`);
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
  //    النسبة تُحسب من original_price الحقيقي فقط، والشارة تظهر فقط عند خصم حقيقي معقول (1-89%)
  let displayOriginalPrice = Number(product.original_price) || 0;
  let discountText = '';

  if (displayOriginalPrice > safePrice) {
    const disc = Math.round(((displayOriginalPrice - safePrice) / displayOriginalPrice) * 100);
    if (disc > 0 && disc < 90) {
      discountText = `${disc}% OFF`;
    } else {
      displayOriginalPrice = 0;
    }
  }

  // 🩹 FIX-IMG — OSS transform 400w (~15KB) — ✨ [card-swatches]: المعاينة كتبدل الصورة
  //    لصورة الـ variant المختار (نفس الـ transform → نفس الأداء)
  const imgSrc = IMG.card(activeSw?.i || product.image_url || product.image || '/placeholder.jpg');

  const productUrl = `/products/${product.id}`;

  return (
    <div
      data-product-id={String(product.id)}
      className={`product-card-wrapper product-card-animated bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden flex flex-col justify-between group relative cursor-pointer transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-md ${
        isTouched ? 'is-active' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* 🩹 FIX-LINK — Link حقيقي (كان div فقط): new-tab / keyboard / SEO.
          stopPropagation يمنع التنفيذ المزدوج (Link يتكفل بالتنقل + div onClick) */}
      <Link
        href={productUrl}
        prefetch={false}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <div className="relative aspect-square bg-temu-offwhite overflow-hidden">
          {/* ✨ img — 🩹 FIX-IMG (OSS transform) + 🩹 FIX-LAZY (lazy/async + eager اختياري)
              ✨ [card-swatches]: activeSw?.i = صورة اللون المختار (نفس OSS transform) */}
          <img
            src={imgSrc}
            alt={product.title || 'Product'}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
          {discountText && (
            <div className="absolute top-2 left-2 bg-temu-error text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
              {discountText}
            </div>
          )}
        </div>

        <div className="p-3 pb-2">
          <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-2 group-hover:text-temu-orange transition min-h-[32px] leading-relaxed">
            {product.title}
          </h3>

          {/* 🩹 FIX-ZERO — بلا سعر حقيقي ما كاينش "$0.00" */}
          {safePrice > 0 && (
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <span className="text-base font-black text-temu-error">
                ${safePrice.toFixed(2)}
              </span>
              {displayOriginalPrice > safePrice && (
                <span className="text-[11px] text-temu-gray-light line-through font-medium">
                  ${displayOriginalPrice.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* ✨ [card-swatches] — صف السواتشات: خارج الـ Link (كليك ما كيبدلش الصفحة)
          stopPropagation يمنع card onClick · hover=معاينة · click=تثبيت */}
      {hasSwatches && (
        <div
          className="px-3 pb-1 flex items-center gap-1.5 flex-wrap"
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
              className={`w-5 h-5 rounded-md overflow-hidden border transition-all duration-150 cursor-pointer p-0 ${
                activeIdx === idx
                  ? 'border-temu-black ring-2 ring-temu-black ring-offset-1 ring-offset-white'
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

      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={handleAddToCart}
          className={`w-full font-bold py-2.5 px-3 rounded-temu-sm transition-all duration-200 flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-90 shadow-sm ${
            isAdded
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-temu-orange hover:bg-temu-orange-bright text-white'
          }`}
        >
          {isAdded ? (
            <>
              <span><GlassIcon i="check" size="xs" /></span> Added to Cart
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
