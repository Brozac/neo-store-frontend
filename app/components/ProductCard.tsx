'use client';

/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc ProductCard — v2.0 (Task 10 Review)
 * ═══════════════════════════════════════════════════════════════
 * 🔴 FIX-IMG (الاكتشاف الكبير) — Image Beast كان مبنيًا وغير موصول بشيء.
 *    الكارت كان يخدم الصورة الخام من CJ CDN (قياسكم الموثق: 259,677B)
 *    بدل transform الخاص بـ OSS (→ 15,696B، −94%).
 *    الآن: IMG.card() على كل صورة كارت —
 *    صفحة feed فيها 30 كارت: ~7.8MB صور → ~0.5MB.
 * 🩹 FIX-LAZY — loading="lazy" + decoding="async": الـ feed اللانهائي
 *    لا يجب أن يحمّل كل الصور دفعة واحدة. eager?: boolean اختياري
 *    (أول 4 كروت في أول صفحة = مرشحو LCP — تمررها من الـ feeds:
 *    <ProductCard product={p} eager={i < 4} />)
 * 🩹 FIX-LINK — <Link> حقيقي حول الصورة + العنوان + السعر:
 *    · middle-click / فتح في تبويب جديد يخدم (كان مستحيلاً على div onClick)
 *    · keyboard: Tab + Enter (div كان غير قابل للتركيز أصلاً)
 *    · الروابط ظاهرة للزواحف (crawlable)
 *    · prefetch={false}: feed فيه عشرات الكروت لا يسبق عشرات صفحات المنتج
 * 🩹 FIX-SILENT — catch الفارغ ({}) ممنوع (Tenet: silence in catch forbidden)
 *    → console.error ينجو من removeConsole (exclude: ['error']) في production
 * 🩹 FIX-ZERO — سعر مفقود كان يعرض "$0.00" = قاتل ثقة → الصف يختفي
 * ───────────────────────────────────────────────────────────────
 * محفوظ كما هو: TRUST FIX (خصم من original_price الحقيقي فقط، 1–89%)
 * · isTouched/is-active · quick-add مع defaultVid · stopPropagation الزر
 * · aspect-square الحاوية = صفر CLS (كان صحيحاً من قبل)
 * ───────────────────────────────────────────────────────────────
 * ⚠️ تذكير أمني (خارج نطاق هذا الملف لكن حياتي): السعر هنا للعرض/السلة فقط.
 *    إعادة التسعير server-side إلزامية في checkout (server.js) قبل أي
 *    PaymentIntent — لا تثق أبداً في سعر قادم من العميل.
 * ═══════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { IMG } from '../../lib/imageOptimizer';

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

  const handleCardClick = () => {
    router.push(`/products/${product.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let defaultVid = '';
    if (product.variants) {
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

  // 🩹 FIX-IMG — كانت الصورة الخام تُقدَّم مباشرة (259KB) — الآن OSS transform 400w (~15KB)
  //    ملاحظة: IMG.card يقبل null ويرجع fallback داخلي؛ نمرر placeholder.jpg كي نحافظ
  //    على نفس الـ fallback القديم بالحرف (local paths تمر عبر getOptimizedImage بلا تغيير)
  const imgSrc = IMG.card(product.image_url || product.image || '/placeholder.jpg');

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
          {/* ✨ img — 🩹 FIX-IMG (OSS transform) + 🩹 FIX-LAZY (lazy/async + eager اختياري) */}
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
              <span>✓</span> Added to Cart
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