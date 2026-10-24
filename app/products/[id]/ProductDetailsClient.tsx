'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';                                    // 🆕 Phase 3
import { useCart } from '../../context/CartContext';
import CountdownTimer from '../../components/CountdownTimer';
import BuyButton from '../../components/BuyButton';
import TiltCard from '../../components/TiltCard';
import DeliveryEstimator from '../../components/DeliveryEstimator';
import { IMG } from '../../../lib/imageOptimizer';
import { GlobeShippingIcon, ReturnsIcon, LockIcon } from '@/components/icons/LaclarcIcons';
import GlassIcon from '@/components/ui/GlassIcon';

// ════════════════════════════════════════════════════════════════
// ProductDetailsClient v1.3 — SERENE_MOCKUP (صفحة المنتج تاع laclarc-serene-v2)
// · معرض بشرائح + نقاط + glassbtn زجاجية (رجوع/قلب) فوق — بلا شريط thumbnails
// · ورقة بيضاء مدورة (rounded-t-[26px] −mt-6): LACLARC + SKU + نجوم ذهبية
//   + سعر fog-600 + بادج خصم وردي + swatches + مقاسات chips + ستيبر دائري
// · أكورديونات (Description/Materials/Size/Shipping) بلا Tabs
// · مراجعات بطاقة .rev (أفاتار دائري بحرف + نجوم butter) + CTA ثابت بالإجمالي
// ─── التحديثات التقنية القديمة (ما تبدلتش):
//
// 🩹 P0 مالي: tiers الخصم (15%/25%) كانوا client-only — prepareSecureItems كيجيب
//    الأسعار من DB (client price مهمل كلياً — Bank-Grade) → السلة كتعرض خصم
//    والـ checkout كيحسب كامل = mismatch مالي. نفس فئة M#15 (applyWheelDiscount
//    المحذوف — "تسرب مالي ميت"). دابا: الكمية فقط · السعر دايماً DB.
//    الخصم الحقيقي = توسعة سيرفر-side (Backlog: qty-tier pricing فـ prepareSecureItems).
// 🩹 P0 Trust×Google: aggregateRating المزيف (4.9/38) من page.tsx محذوف — Google spam policy.
// 🛡️ P1: reviews بلا Array.isArray guard كان يكسر الصفحة البيضاء على error shape
// 🛡️ P2: regex-escape للحجم · parse-safe للمفضلة + cap 100 · noopener · أبواب صامتة
// 🧹: spans خاويين حيدو (نفس نمط HeroSection — إيموجيات طايحة)
// ⚠️ M#45 موثق (ما تبدلش — قرار المالك): "insured delivery" · "30-Day Guarantee"
// ════════════════════════════════════════════════════════════════
//
// 🆕 v1.2 [variant-truth] Kit 29j — محرّك الفاريانت الحقيقي (من قراءة معمّقة لتوثيق CJ Product API)
//
// 🔴 P0 مالي مصلّح: الماتشر القديم كان كيقارن hex اللون بـ variantKey بـ includes → فاشل دائماً
//    ("Black-XS") — والألوان مخزّنة hex ("#000000") → مطابقة مستحيلة → exact-match كيفشل
//    دايماً → كيرجع لـ size-only match → الزبون يختار "Army Green+XXXL" والسيرفر يطلب
//    أول "XXXL" فاللائحة (Yellow-XXXL!) — vid خاطئ = بضاعة خاطئة = ريفونات.
//    مثبت على الداتا الحية: 96917 فيه 8 عائلات لون و colors[] فيها 6 برك.
// 🆕 الحل: مجموعات اللون كتشتق من variantKey نفسو (strip الحجم) — كل مجموعة عندها:
//    صورة variantImage الحقيقية (526/526 معمّرين فالداتا الحية) + مقاساتها الفعلية
//    (2XL/3XL الناقصة من DB sizes[] كيبانو دابا).
// 🛡️ بلا تجاوز للون: الفاريانت كيتلقا داخل المجموعة فقط — size-match عابر للألوان ممنوع.
// 🖼️ اختيار اللون كيقاد للصورة الحقيقية تاع ذاك اللون فالمعرض (Temu/Shein pattern).
// ⚠️ درس اللايف (96814): variantSellPrice = كلفة CJ (wholesale) ماشي سعر البيع —
//    DB فيها retail (20.99) والـ variants فيهم كلفة (4.90/6.59). عرض الكلفة للزبون
//    = تسريب هامش → العرض كيبقى safePrice (DB) والـ checkout Bank-Grade كيما كان.
//    (variantSellPrice كيتخزن فالمحرك للـ admin/backlog — ما كيتعرضش للزبون أبداً)

// 🩹 TRUST — LivePurchaseNotification محذوف نهائياً (social-problem وهمي: أسماء/مدن عشوائية)
// 🆕 Phase 3 — مكونات ما تشافش في أول paint — تُحمّل عند الحاجة فقط
const FrequentlyBoughtTogether = dynamic(
  () => import('../../components/FrequentlyBoughtTogether'),
  {
    ssr: false,
    loading: () => <div className="h-48 animate-pulse bg-gray-50 rounded-2xl my-8" />, // skeleton — لا layout jump
  }
);
const ReviewForm = dynamic(() => import('../../components/ReviewForm'), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse bg-gray-50 rounded-2xl" />,
});

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  category?: string;
  image?: string;
  image_url?: string;
  description?: string;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  variants?: any[];
  rating?: number;
  sales_count?: number;
  is_sourced?: boolean;      // 🩹 — flash-deal timer gating (honest edition)
  composition?: string;
  material?: string;
  chest_pad?: string;
  wires?: string;
  pattern?: string;
  support?: string;
  instruction?: string;
  origin?: string;
  store_name?: string;
  store_followers?: number;
  store_sales?: string;
  video_url?: string;
}

interface Review {
  id: number | string; // [cj-reviews v2] صفوف CJ بمعرفات نصية cj-…
  author: string;
  rating: number;
  content: string;
  country: string;
  created_at: string;
  images?: string[];
}

// ✨ SERENE_MOCKUP — أكورديونات بلاصة الـ Tabs (طبق الأصل .acc تاع المعاينة)
const ACCORDIONS = [
  { key: 'desc', label: 'Description' },
  { key: 'materials', label: 'Materials & Care' },
  { key: 'size', label: 'Size & Fit' },
  { key: 'shipping', label: 'Shipping & Returns' },
] as const;

type AccKey = (typeof ACCORDIONS)[number]['key'];

// ⭐ [cj-reviews v2] — «Load more» كيزيد بـ 6 كل ضغطة (نفس حجم الشبكة، نفس بداية v1)
const REVIEWS_PAGE = 6;

// 🛡️ [variant-truth] escape regex — مقاسات فيها رموز خاص ("S/M", "4 (Kids)") ما يرميوش
const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function ProductDetailsClient({
  product,
  initialReviews,
  relatedProducts
}: {
  product: Product;
  initialReviews: Review[];
  relatedProducts: Product[];
}) {
  const router = useRouter();
  const { addToCart } = useCart();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedColorName, setSelectedColorName] = useState('');   // 🆕 [variant-truth] اسم عائلة اللون (من variantKey) — hex بقى legacy فقط
  const [selectedSize, setSelectedSize] = useState('');             // 🆕 بلا افتراض 'M' — المحرك كيشتق المقاس الفعلي (effectiveSize)
  // ✨ SERENE_MOCKUP — أكورديون مفتوح ('desc' مفتوح اصلاً كيما المعاينة) بلاصة activeTab
  const [openAcc, setOpenAcc] = useState<AccKey | 'none'>('desc');
  const [reviews, setReviews] = useState(initialReviews);
  // ⭐ [cj-reviews v2] — فلتر النجوم + Load more + الإجمالي الحقيقي (meta.total من CJ)
  const [starFilter, setStarFilter] = useState(0); // 0 = الكل · 1..5 فلتر نجمي
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_PAGE);
  const [reviewsMeta, setReviewsMeta] = useState<{ total: number; loaded: number; hasMore: boolean } | null>(null);

  // ⭐ [cj-reviews v2] — الإجمالي الحقيقي مع fallback للشكل القديم (array بلا meta)
  const realTotal = reviewsMeta?.total ?? reviews.length;

  const starCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const k = Math.round(r.rating);
      if (k >= 1 && k <= 5) c[k]++;
    }
    return c;
  }, [reviews]);

  const filteredReviews = useMemo(
    () => (starFilter === 0 ? reviews : reviews.filter(r => Math.round(r.rating) === starFilter)),
    [reviews, starFilter]
  );
  const shownReviews = filteredReviews.slice(0, visibleReviews);

  // 🛡️ [cj-reviews v2] — شكلين مقبولين: array (backend قديم) ولا {reviews, meta} (v2)
  //    → التركيب آمن مهما كان ترتيب deploy تاع الفرونت/الباك.
  const applyReviewsPayload = (data: unknown) => {
    if (Array.isArray(data)) {
      setReviews(data as Review[]);
      setReviewsMeta(null);
      return;
    }
    if (data && typeof data === 'object' && Array.isArray((data as { reviews?: unknown }).reviews)) {
      const payload = data as { reviews: Review[]; meta?: { total?: number; loaded?: number; hasMore?: boolean } };
      setReviews(payload.reviews);
      const m = payload.meta;
      const loaded = payload.reviews.length;
      setReviewsMeta(m
        ? { total: Number(m.total) || loaded, loaded: Number(m.loaded) || loaded, hasMore: Boolean(m.hasMore) }
        : null);
      return;
    }
    setReviews([]); // 🛡️ error shape غير-array كان يكسر الصفحة كاملة (نفس حماية v1)
    setReviewsMeta(null);
  };
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [stickyAdded, setStickyAdded] = useState(false);
  const [mainAdded, setMainAdded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const touchStartX = useRef(0);
  const mainCtaRef = useRef<HTMLDivElement>(null);

  const defaultImage = '/icon-512.png';

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ═══ 🆕 [variant-truth] Kit 29j — محرّك الفاريانت الحقيقي ═══
  // الحقيقة من variantKey نفسو ("Black-XS" → لون Black + حجم XS) — colors[] من DB مش موثوقة.
  const variantEngine = useMemo(() => {
    const dbSizes: string[] = Array.isArray(product.sizes)
      ? product.sizes.filter((s): s is string => typeof s === 'string')
      : [];
    let vars: any[] = [];
    try {
      const parsed = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
      if (Array.isArray(parsed)) vars = parsed;
    } catch { /* 🩹 parse-safe — variants فاسدة ما تكسرش الصفحة */ }

    const SIZE_RX = /^(xxs|xs|s|m|l|xl|2xl|xxl|3xl|xxxl|4xl|xxxxl|5xl|one[- ]?size|free[- ]?size|custom)$/i;

    // "Black-XS" → [Black, XS] · "Rose Red" → [Rose Red, ''] · "One-Size" آمن (SIZE_RX)
    const splitKey = (key: string): [string, string] => {
      const i = key.lastIndexOf('-');
      if (i === -1) return [key, ''];
      const right = key.slice(i + 1);
      if (dbSizes.some(s => s.toLowerCase() === right.toLowerCase()) || SIZE_RX.test(right)) {
        return [key.slice(0, i), right];
      }
      return [key, ''];
    };

    interface VariantItem { raw: any; vid: string; size: string; price: number | null; }
    interface ColorGroup { name: string; image: string; items: VariantItem[]; sizes: string[]; hex: string | null; }
    const groups: ColorGroup[] = [];
    const byName = new Map<string, ColorGroup>();
    const flat: VariantItem[] = [];
    for (const v of vars) {
      const vid = v?.vid != null ? String(v.vid) : '';
      if (!vid) continue;                                  // 🛡️ بلا vid ما كيتطلبش من CJ
      const key = String(v?.variantKey || v?.variantNameEn || '').trim();
      const [color, size] = splitKey(key);
      if (!color) continue;
      let g = byName.get(color.toLowerCase());
      if (!g) {
        g = { name: color, image: '', items: [], sizes: [], hex: null };
        byName.set(color.toLowerCase(), g);
        groups.push(g);
      }
      if (!g.image && v?.variantImage) g.image = String(v.variantImage);
      const item: VariantItem = { raw: v, vid, size, price: v?.variantSellPrice != null ? Number(v.variantSellPrice) : null };
      g.items.push(item);
      flat.push(item);
      if (size && !g.sizes.includes(size)) g.sizes.push(size);
    }

    // ترتيب canon — ظهور CJ ماشي مرتّب (شفت Pink: 2XL,3XL,L,M,S,XL فالداتا الحية)
    const CANON = ['xxs','xs','s','m','l','xl','2xl','xxl','3xl','xxxl','4xl','xxxxl','5xl','one size','one-size'];
    const canonIdx = (s: string) => {
      const i = CANON.indexOf(s.toLowerCase());
      return i === -1 ? 99 : i;
    };
    for (const g of groups) g.sizes.sort((a, b) => canonIdx(a) - canonIdx(b) || a.localeCompare(b));

    // hex mapping — غير إلا العدد متطابق معقول (96854: 2=2 ✓) · colors[] ناقصة (96917: 6 مقابل 8)
    const cols = Array.isArray(product.colors)
      ? product.colors.filter((c): c is string => typeof c === 'string')
      : [];
    if (groups.length > 1 && groups.length === cols.length) {
      groups.forEach((g, i) => { g.hex = cols[i]; });
    }

    return { groups, flat };
  }, [product]);

  // اللون المختار — الافتراضي أول مجموعة · المجموعة هي مصدر الحقيقة
  const selectedGroup = useMemo(() => {
    const gs = variantEngine.groups;
    if (gs.length === 0) return null;
    return gs.find(g => g.name.toLowerCase() === selectedColorName.toLowerCase()) || gs[0];
  }, [variantEngine, selectedColorName]);

  // المقاسات المتاحة = مقاسات المجموعة الحقيقية (2XL/3XL الناقصة من DB كيبانو دابا)
  const availableSizes = useMemo(() => {
    if (selectedGroup && selectedGroup.sizes.length > 0) return selectedGroup.sizes;
    return Array.isArray(product.sizes)
      ? product.sizes.filter((s): s is string => typeof s === 'string')
      : [];
  }, [selectedGroup, product.sizes]);

  // المقاس الفعلي: المختار إلا كاين فالمجموعة، وإلا أول مقاس متاح — كيمنع "مقاس غير موجود"
  const effectiveSize = useMemo(() => {
    if (!selectedGroup || selectedGroup.sizes.length === 0) return '';
    return selectedGroup.sizes.includes(selectedSize) ? selectedSize : selectedGroup.sizes[0];
  }, [selectedGroup, selectedSize]);

  // 🎯 الفاريانت المطابق — داخل المجموعة فقط (P0: ما بقاش size-match عابر للألوان)
  const matchedVariant = useMemo(() => {
    const { groups, flat } = variantEngine;
    if (groups.length === 0) return flat[0] || null;        // fallback قديم: أول variant بـ vid
    const g = selectedGroup || groups[0];
    if (!effectiveSize) return g.items[0] || null;
    const rx = new RegExp(`^${escRx(effectiveSize)}$`, 'i');
    return g.items.find(it => it.size && rx.test(it.size)) || g.items[0] || null;
  }, [variantEngine, selectedGroup, effectiveSize]);

  // 🖼️ صورة اللون المختار كتزول قدام فالمعرض (variantImage معمّرة 526/526 فالداتا الحية)
  const variantImage = selectedGroup?.image || '';
  const galleryImages = useMemo(() => {
    const base = (product.images && Array.isArray(product.images) && product.images.length > 0)
      ? product.images.filter(img => img && typeof img === 'string')
      : [product.image_url || product.image || defaultImage];
    if (variantImage && !base.includes(variantImage)) return [variantImage, ...base];
    return base;
  }, [product, defaultImage, variantImage]);

  const mainImageSrc = galleryImages[currentImageIndex] || galleryImages[0] || defaultImage;

  // قفزة تلقائية للصورة تاع اللون (كيتبدل غير الـ index المشتق — السوايب اليدوي باقي)
  const variantImageIdx = variantImage ? galleryImages.indexOf(variantImage) : -1;
  useEffect(() => {
    if (variantImageIdx >= 0) setCurrentImageIndex(variantImageIdx);
  }, [variantImageIdx]);

  // 🛡️ parse-safe للمفضلة — localStorage فاسد ما يكسرش الزر (نفس نمط CartContext v1.1)
  //    + cap 100 = مطابق لـ by-ids LIMIT 100 (API)
  const parseFavorites = (): string[] => {
    try {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      return Array.isArray(favs) ? favs.map(String).slice(0, 100) : [];
    } catch (e) {
      console.warn('favorites: corrupted localStorage — reset', e);
      return [];
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    setFavoriteIds(parseFavorites());

    fetch(`${API_BASE_URL}/api/reviews/${product.id}?v2=1`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { applyReviewsPayload(data); }) // 🛡️ [cj-reviews v2] شكلين مقبولين — array قديم ولا {reviews, meta}
      .catch((err) => { if (err?.name !== 'AbortError') console.warn('reviews: fetch failed', err); });

    return () => {
      controller.abort();
    };
  }, [product.id, API_BASE_URL]);

  useEffect(() => {
    const target = mainCtaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting && window.scrollY > 400);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    // 🩹 SERENE_MOCKUP — fallback بالـ scroll (قياس rect مباشر): الـ IO بوحدو ما كافيش
    //    فبعض الحالات (scroll سريع/برمجي) — الحساب من rect دقيق دايماً و passive = رخيص
    const onScroll = () => {
      const r = target.getBoundingClientRect();
      setShowStickyBar((r.bottom < 0) && window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);


  const parsePrice = (price: any) => Number(price) || 0;
  const stripHtml = (html?: string) => html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const getColorHex = (c: string) => c.startsWith('#') ? c : '#888888';

  const safePrice = parsePrice(product.price);
  const safeOriginalPrice = parsePrice(product.original_price);
  // ✨ SERENE_MOCKUP — صف .pd-meta: نجمة ذهبية + مبيعات حقيقية (sales_count من DB)
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : (typeof product.rating === 'number' && product.rating > 0 ? product.rating : null);
  const soldCount = typeof product.sales_count === 'number' && product.sales_count > 0 ? product.sales_count : 0;
  const discountPct = safeOriginalPrice > safePrice
    ? Math.round(((safeOriginalPrice - safePrice) / safeOriginalPrice) * 100)
    : 0;

  // 💰 [variant-truth] درس اللايف: variantSellPrice = كلفة CJ — العرض للزبون كيبقى سعر الـ DB
  //    (الـ checkout أصلاً Bank-Grade من prepareSecureItems). الفاريانت الحقيقي = vid صحيح فقط.

  // 🩹 P0 مالي: discountedUnitPrice (×0.85/×0.75) محذوف — خصم client-only ما كيتطبقش
  //    فالـ checkout (prepareSecureItems من DB) — تفاصيل فالهيدر. Backlog: qty-tier سيرفر-side.

  const handleToggleFavorite = (productId: string | number) => {
    const idStr = String(productId);
    const favorites = parseFavorites();
    const newFavorites = favorites.includes(idStr)
      ? favorites.filter((f: string) => f !== idStr)
      : [...favorites, idStr];
    localStorage.setItem('favorites', JSON.stringify(newFavorites.slice(0, 100)));
    setFavoriteIds(newFavorites);
  };

  const handleAddToCart = () => {
    const resolvedVid = matchedVariant?.vid || '';

    addToCart({
      id: product.id,
      title: product.title,
      name: product.title,
      price: safePrice, // 🩹 P0: السعر الحقيقي من DB — السلة والـ checkout كيتلاقاو (Bank-Grade)
      quantity,
      image: mainImageSrc,
      image_url: mainImageSrc,
      color: selectedGroup?.name || selectedColorName || '',   // 🩹 اسم مقروء عوض hex خام
      size: effectiveSize || '',
      vid: resolvedVid
    }, quantity);

    // 🎯 Mission #15 — feedback فوري
    setMainAdded(true);
    setTimeout(() => setMainAdded(false), 1500);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isZoomed) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        setCurrentImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
      } else {
        setCurrentImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
      }
    }
  };

  const isCurrentProductFavorited = favoriteIds.includes(String(product.id));

  const detailBullets: string[] = [];
  if (product.material) detailBullets.push(`Material: ${product.material}`);
  if (product.composition) detailBullets.push(`Composition: ${product.composition}`);
  if (product.pattern) detailBullets.push(`Pattern: ${product.pattern}`);
  if (product.origin) detailBullets.push(`Origin: ${product.origin}`);
  return (
    <main className="min-h-screen pb-44 font-sans">
      <div className="max-w-md mx-auto">

        {/* ═══ 🎨 SERENE_MOCKUP — المعرض (.gallery): شرائح + نقاط + float-head زجاجي ═══ */}
        <div
          className="relative h-[340px] sm:h-[440px] overflow-hidden bg-linear-to-b from-fog-100 via-fog-50 to-white touch-pan-y cursor-zoom-in"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => { setIsLightboxOpen(true); setIsZoomed(false); }}
        >
          {showVideo && product.video_url ? (
            <video src={product.video_url} controls autoPlay className="w-full h-full object-cover" />
          ) : (
            <img
              src={IMG.detail(mainImageSrc)}
              srcSet={`${IMG.card(mainImageSrc)} 400w, ${IMG.detail(mainImageSrc)} 800w`}
              sizes="(max-width: 768px) 100vw, 448px"
              fetchPriority="high"
              decoding="async"
              alt={product.title}
              className="w-full h-full object-contain p-7 transition-transform duration-500"
            />
          )}

          {/* float-head — glassbtn 38px: رجوع | تشغيل+قلب (rgba(255,255,255,.88) + blur 8px) */}
          <div className="absolute top-3 inset-x-3 flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-[38px] h-[38px] rounded-full bg-white/88 backdrop-blur-[8px] grid place-items-center text-fog-700 shadow-[0_4px_14px_rgba(46,64,87,0.16)] transition cursor-pointer active:scale-90"
              aria-label="Go back"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>

            <div className="flex items-center gap-2">
              {product.video_url && (
                <button
                  type="button"
                  onClick={() => setShowVideo((v) => !v)}
                  className="w-[38px] h-[38px] rounded-full bg-white/88 backdrop-blur-[8px] grid place-items-center text-fog-700 shadow-[0_4px_14px_rgba(46,64,87,0.16)] transition cursor-pointer active:scale-90"
                  aria-label={showVideo ? 'Close video' : 'Play product video'}
                  title={showVideo ? 'Close video' : 'Play video'}
                >
                  {showVideo ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleToggleFavorite(product.id)}
                aria-pressed={isCurrentProductFavorited}
                aria-label="Save to Wishlist"
                className={`w-[38px] h-[38px] rounded-full bg-white/88 backdrop-blur-[8px] grid place-items-center shadow-[0_4px_14px_rgba(46,64,87,0.16)] transition cursor-pointer active:scale-90 ${
                  isCurrentProductFavorited ? 'text-coral-500' : 'text-fog-700'
                }`}
              >
                <svg
                  key={String(isCurrentProductFavorited)}
                  className={isCurrentProductFavorited ? 'animate-scale' : ''}
                  width="17" height="17" viewBox="0 0 24 24"
                  fill={isCurrentProductFavorited ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
                </svg>
              </button>
            </div>
          </div>

          {/* gdots — نقاط فوق الورقة (bottom-9 ≈ 40px تاع المعاينة) — ضبابية على الخلفية الفاتحة */}
          {galleryImages.length > 1 && !showVideo && (
            <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); setShowVideo(false); }}
                  aria-label={`Image ${i + 1} of ${galleryImages.length}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    currentImageIndex === i ? 'w-4 bg-fog-600' : 'w-1.5 bg-fog-300/80 hover:bg-fog-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══ 🎨 SERENE_MOCKUP — ورقة المنتج (.pd-body): rounded-t-[26px] + −mt-6 فوق المعرض ═══ */}
        <div className="relative -mt-6 bg-white rounded-t-[26px] shadow-[0_-8px_24px_rgba(91,126,166,0.10)] px-5 pt-4 pb-6">

          {/* pd-toprow — براند Marcellus (.28em) + SKU */}
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-brand text-[10.5px] tracking-[0.28em] text-temu-gray-text">LACLARC</span>
            <span className="text-[10px] tracking-[0.08em] text-temu-gray-text">SKU: LAC-{product.id}</span>
          </div>

          <h1 className="text-[19px] font-extrabold leading-[1.4] text-temu-black">{product.title}</h1>

          {/* pd-meta — نجمة ذهبية butter + تقييم حقيقي + مبيعات DB */}
          <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] text-temu-gray-text flex-wrap">
            {avgRating != null ? (
              <>
                <span className="flex items-center gap-0.5 text-butter-up-600 font-extrabold">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"></path></svg>
                  {avgRating.toFixed(1)}
                </span>
                <span>· {realTotal} verified rating{realTotal !== 1 ? 's' : ''}</span>
              </>
            ) : (
              <span className="font-bold"><GlassIcon ch="✨" size="xs" /> New in catalog — be the first to review</span>
            )}
            {soldCount > 0 && <span>· {soldCount.toLocaleString('en-US')}+ sold</span>}
          </div>

          {/* pd-price — 22px fog-600 + شطب + بادج −X% وردي (.off تاع المعاينة) */}
          <div className="flex items-baseline gap-2.5 mt-3">
            <b className="text-[22px] font-extrabold text-fog-600">${safePrice.toFixed(2)}</b>
            {safeOriginalPrice > safePrice && (
              <>
                <s className="text-[13px] text-temu-gray-text">${safeOriginalPrice.toFixed(2)}</s>
                <span className="bg-coral-500/15 text-coral-600 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full">-{discountPct}%</span>
              </>
            )}
          </div>

          {/* .swatches — دوائر 34px، النشطة ring fog-500 (0 0 0 2px #fff + 4px primary تاع المعاينة) */}
          {variantEngine.groups.length > 1 && (
            <div className="mt-4">
              <p className="text-[12.5px] font-bold text-temu-black mb-2">
                Color: <b className="text-fog-600">{selectedGroup?.name}</b>
              </p>
              <div className="flex gap-2.5 flex-wrap">
                {variantEngine.groups.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setSelectedColorName(g.name)}
                    title={g.name}
                    aria-label={`Color ${g.name}`}
                    aria-pressed={selectedGroup?.name === g.name}
                    className={`w-[34px] h-[34px] rounded-full overflow-hidden transition cursor-pointer active:scale-90 ${
                      selectedGroup?.name === g.name
                        ? 'ring-2 ring-fog-500 ring-offset-2 ring-offset-white'
                        : 'ring-1 ring-fog-200 hover:ring-fog-300'
                    }`}
                  >
                    {g.image ? (
                      <img
                        src={IMG.thumb(g.image)}
                        alt={g.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span style={{ backgroundColor: getColorHex(g.hex || g.name) }} className="block w-full h-full"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* fallback قديم — بلا variants صالحين: دوائر hex كيما قبل (بلا أثر على الـ vid) */}
          {variantEngine.groups.length <= 1 && product.colors && product.colors.length > 0 && (
            <div className="mt-4">
              <p className="text-[12.5px] font-bold text-temu-black mb-2">
                Color: {!(selectedColorName || product.colors[0] || '').startsWith('#') && (
                  <b className="text-fog-600">{selectedColorName || product.colors[0]}</b>
                )}
              </p>
              <div className="flex gap-2.5 flex-wrap">
                {product.colors.map((col, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedColorName(col)}
                    title={col}
                    aria-label={`Color ${col}`}
                    className={`w-[34px] h-[34px] rounded-full transition cursor-pointer active:scale-90 ${
                      selectedColorName === col
                        ? 'ring-2 ring-fog-500 ring-offset-2 ring-offset-white'
                        : 'ring-1 ring-fog-200 hover:ring-fog-300'
                    }`}
                  >
                    <span style={{ backgroundColor: getColorHex(col) }} className="block w-full h-full rounded-full"></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* .sizes — chips 38px، النشط fog-600 أبيض بظل (طبق المعاينة) */}
          {availableSizes.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[12.5px] font-bold text-temu-black">
                  Size: <b className="text-fog-600">{effectiveSize || '—'}</b>
                </p>
                <button type="button" onClick={() => setOpenAcc('size')} className="text-[11px] font-bold text-fog-600 cursor-pointer hover:underline">
                  Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`min-w-[42px] h-[38px] px-3 rounded-[13px] text-[12.5px] font-bold transition cursor-pointer active:scale-95 ${
                      effectiveSize === sz
                        ? 'bg-fog-600 text-white shadow-[0_4px_14px_rgba(70,100,138,0.35)]'
                        : 'bg-fog-100 text-temu-gray-text hover:bg-fog-200/60'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Countdown للعرضات الحقيقية فقط + مقدّر التوصيل */}
          {product.is_sourced === true && <div className="mt-4"><CountdownTimer /></div>}
          <div className="mt-4"><DeliveryEstimator productId={product.id} /></div>

          {/* qtyrow — ستيبر دائري (.stepper تاع المعاينة: أزرار بيضاء 32px على حبة fog) */}
          <div className="flex items-center justify-between mt-5">
            <p className="text-[12.5px] font-bold text-temu-black">Quantity</p>
            <div className="flex items-center gap-1 bg-fog-100 rounded-full p-1" role="group" aria-label="Quantity">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="w-8 h-8 rounded-full bg-white text-fog-600 font-extrabold text-base grid place-items-center shadow-[0_2px_8px_rgba(46,64,87,0.14)] transition active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed leading-none"
              >
                −
              </button>
              <b className="min-w-[30px] text-center text-sm text-temu-black tabular-nums" aria-live="polite">{quantity}</b>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
                className="w-8 h-8 rounded-full bg-white text-fog-600 font-extrabold text-base grid place-items-center shadow-[0_2px_8px_rgba(46,64,87,0.14)] transition active:scale-90 cursor-pointer leading-none"
              >
                +
              </button>
            </div>
          </div>

          {/* CTA الرئيسية — mainCtaRef كيشغّل الـ sticky observer */}
          <div ref={mainCtaRef} className="mt-5 space-y-2.5">

            <button
              type="button"
              onClick={handleAddToCart}
              className={`w-full text-white font-extrabold text-[15px] py-3.5 rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-[.98] shadow-lg ${
                mainAdded
                  ? 'bg-maroccan-tea-600 shadow-maroccan-tea-600/25'
                  : 'bg-linear-to-r from-fog-600 via-fog-500 to-fog-400 shadow-fog-500/35'
              }`}
            >
              {mainAdded ? (
                <><GlassIcon i="check" size="xs" /> Added to Bag — View Cart</>
              ) : (
                <>Add to Cart</>
              )}
            </button>

            <BuyButton
              product={{
                id: product.id,
                title: product.title,
                name: product.title,
                price: safePrice, // 🩹 P0: DB-true — السيرفر هو الحكم (prepareSecureItems)
                image: mainImageSrc,
                color: selectedGroup?.name || selectedColorName || '',
                size: effectiveSize || '',
                quantity: quantity,
                vid: matchedVariant?.vid || ''
              }}
            />

            {/* 🩹 TRUST — بلوك "48 shoppers" المحذوف نهائياً — البديل الحقيقي: sold_count من DB (فوق فـ pd-meta) */}

            {/* صف الثقة — M#45 موثق (النصوص ما تبدلتش) */}
            <div className="grid grid-cols-3 gap-2 pt-3 text-[10px] text-temu-gray-text font-semibold border-t border-fog-100">
              <div className="flex flex-col items-center gap-1">
                <GlobeShippingIcon size={18} active />
                Free Shipping
              </div>
              <div className="flex flex-col items-center gap-1">
                <ReturnsIcon size={18} active />
                30-Day Guarantee
              </div>
              <div className="flex flex-col items-center gap-1">
                <LockIcon size={18} active />
                Secure Checkout
              </div>
            </div>
          </div>{/* ← نهاية CTA */}
        </div>{/* ← نهاية ورقة المنتج (.pd-body) */}

        {/* ═══ 🎨 SERENE_MOCKUP — أكورديونات (.acc) بلاصة الـ Tabs ═══ */}
        <div className="mt-4 space-y-2.5">
          {ACCORDIONS.map((acc) => {
            const isOpen = openAcc === acc.key;
            return (
              <div key={acc.key} className="border border-fog-100 rounded-2xl bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenAcc(isOpen ? 'none' : acc.key)}
                  aria-expanded={isOpen}
                  className="w-full flex justify-between items-center px-4 py-3 text-[13px] font-bold text-temu-black cursor-pointer"
                >
                  {acc.label}
                  <svg className={`w-3.5 h-3.5 shrink-0 text-temu-gray-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-[1400px]' : 'max-h-0'}`}>
                  <div className="px-4 pb-3.5 text-xs leading-[1.95] text-temu-gray-text">
                    {acc.key === 'desc' && (
                      <>
                        <p className="mb-2">{stripHtml(product.description) || 'Full specifications available — contact support for any question.'}</p>
                        {detailBullets.length > 0 && (
                          <ul className="space-y-1 list-disc list-inside">
                            {detailBullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        )}
                      </>
                    )}

                    {/* 🩹 M#45: "hypoallergenic" = وعد صحي بلا مصدر على منتجات بلا بيانات */}
                    {acc.key === 'materials' && (
                      <>
                        <p>{product.material || 'Material specifications not provided by the supplier — contact support for details.'}</p>
                        {product.composition && <p className="mt-1.5">Composition: {product.composition}</p>}
                      </>
                    )}

                    {acc.key === 'size' && (
                      <p>Standard fit. Order your typical size. Detailed guide available upon request from support.</p>
                    )}

                    {acc.key === 'shipping' && (
                      <>
                        {/* ⚠️ M#45 backlog (توثيق — قرار المالك): "insured" بلا سند + "24–48h"
                            خاصو يتقاطع مع predictDelivery الحقيقي (shipTruth median) */}
                        <p>Worldwide insured delivery. Shipped in 24–48 hours directly via CJ Dropshipping.</p>
                        <p className="mt-1.5 text-[11px]">Typical transit time: 7–15 business days depending on destination country.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {relatedProducts.length > 0 && (
          <FrequentlyBoughtTogether
            currentProduct={product}
            relatedProducts={relatedProducts}
          />
        )}

        {/* You May Also Like — كروت fog مدورة (نفس كروت الموكاب) */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-fog-100 pt-8 mt-6">
            <h2 className="text-base font-extrabold text-temu-black mb-4">You May Also Like</h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((p) => (
                <TiltCard key={p.id}>
                  <Link href={`/products/${p.id}`} className="group flex flex-col h-full bg-white border border-fog-100 rounded-2xl overflow-hidden active:scale-[.97] transition shadow-[0_4px_18px_rgba(91,126,166,0.07)]">
                    <div className="relative aspect-square overflow-hidden bg-fog-50">
                      <img
                        src={IMG.card(p.image_url || p.image || defaultImage)}
                        alt={p.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-2 transition group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3 pt-2 flex flex-col justify-between flex-1">
                      <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-1 group-hover:text-fog-600 transition-colors">{p.title}</h3>
                      <p className="text-fog-600 font-extrabold text-sm">${parsePrice(p.price).toFixed(2)}</p>
                    </div>
                  </Link>
                </TiltCard>
              ))}
            </div>
          </div>
        )}

        {/* Customer Reviews — 🩹 TRUST: مراجعات حقيقية فقط (بعد تنضيف 237,627 وهمية) */}
        <div className="border-t border-fog-100 pt-8 mt-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-extrabold text-temu-black">Customer Reviews ({realTotal})</h2>
            {reviews.length > 0 && (
              <span className="text-[11px] font-bold text-maroccan-tea-600"><GlassIcon i="check" size="xs" /> Verified</span>
            )}
          </div>

          {/* ⭐ [cj-reviews v2] — فلتر النجوم بعدادات حية (الكل + 5★…1★) */}
          {reviews.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button
                onClick={() => { setStarFilter(0); setVisibleReviews(REVIEWS_PAGE); }}
                className={starFilter === 0
                  ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-fog-600 text-white shadow-sm transition-all duration-200'
                  : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-temu-gray-text border border-fog-200 hover:border-fog-400 hover:text-fog-600 transition-all duration-200 cursor-pointer'}
              >
                All ({realTotal})
              </button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  onClick={() => { setStarFilter(s); setVisibleReviews(REVIEWS_PAGE); }}
                  className={starFilter === s
                    ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-fog-600 text-white shadow-sm transition-all duration-200'
                    : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-temu-gray-text border border-fog-200 hover:border-fog-400 hover:text-fog-600 transition-all duration-200 cursor-pointer'}
                >
                  {s}★ ({starCounts[s]})
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {shownReviews.map((rev) => (
              <div key={rev.id} className="rev flex gap-3 p-3.5 bg-white border border-fog-100 rounded-2xl">
                {/* .rava — أفاتار دائري بحرف البداية (fog Well) */}
                <div className="w-9 h-9 rounded-full bg-fog-100 text-fog-700 grid place-items-center font-extrabold text-[13px] shrink-0" aria-hidden="true">
                  {(rev.author || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2">
                    <b className="text-[12.5px] text-temu-black truncate">{rev.author} <span className="font-normal text-temu-gray-text">({rev.country || 'Verified Buyer'})</span></b>
                    <span className="text-butter-up-600 text-[10.5px] tracking-[1px] shrink-0">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-[11.5px] text-temu-gray-text leading-[1.8] mt-1">{rev.content}</p>

                  {rev.images && Array.isArray(rev.images) && rev.images.length > 0 && (
                    <div className="flex gap-2 pt-1.5">
                      {rev.images.map((photoUrl, pIdx) => (
                        <div
                          key={pIdx}
                          className="relative w-14 h-14 rounded-xl overflow-hidden border border-fog-100 bg-fog-50 cursor-pointer hover:scale-105 transition"
                          onClick={() => window.open(photoUrl, '_blank', 'noopener,noreferrer')}
                          title="Click to view full photo"
                        >
                          <img
                            src={IMG.thumb(photoUrl)}
                            alt="Buyer proof photo"
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-temu-gray-text/70 block mt-1.5">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ⭐ [cj-reviews v2] — حالة خاوية للفلتر النشيط */}
          {reviews.length > 0 && filteredReviews.length === 0 && (
            <div className="text-center py-10 mb-6 border border-dashed border-fog-200 rounded-2xl text-sm text-temu-gray-text">
              No reviews with this star rating yet.
            </div>
          )}

          {/* ⭐ [cj-reviews v2] — Load more + العدد المتبقي */}
          {filteredReviews.length > shownReviews.length && (
            <div className="flex flex-col items-center gap-2 mb-6">
              <button
                onClick={() => setVisibleReviews(c => c + REVIEWS_PAGE)}
                className="px-8 py-3 rounded-full text-sm font-extrabold bg-linear-to-r from-fog-600 to-fog-400 text-white hover:opacity-90 shadow-[0_4px_14px_rgba(91,126,166,0.3)] transition-all duration-300 cursor-pointer active:scale-[.97]"
              >
                Load more reviews ({filteredReviews.length - shownReviews.length} more)
              </button>
              {reviewsMeta?.hasMore && (
                <span className="text-[11px] text-temu-gray-text">
                  Showing {reviews.length} of {realTotal} reviews
                </span>
              )}
            </div>
          )}

          <ReviewForm
            productId={product.id}
            onReviewAdded={() => {
              fetch(`${API_BASE_URL}/api/reviews/${product.id}?v2=1`)
                .then(r => r.json())
                .then(data => applyReviewsPayload(data))
                .catch(() => {});
            }}
          />
        </div>

      </div>
      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md animate-fade-in select-none"
          onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
        >
          <div className="flex justify-between items-center w-full max-w-6xl mx-auto z-20" onClick={e => e.stopPropagation()}>
            <div className="bg-white/10 backdrop-blur-md text-white font-mono text-xs px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
              {currentImageIndex + 1} / {galleryImages.length}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-full border border-white/10 transition cursor-pointer text-xs font-bold active:scale-95 flex items-center gap-1.5"
                title={isZoomed ? "Reset Zoom" : "Zoom In (2.5x)"}
              >
                <span><GlassIcon ch="🔍" size="xs" /></span> {isZoomed ? 'Reset (1x)' : 'Zoom (2.5x)'}
              </button>

              <button
                type="button"
                onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
                className="bg-white/20 hover:bg-white/40 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition cursor-pointer active:scale-90"
                aria-label="Close Lightbox"
              >
                <GlassIcon i="x" size="xs" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 w-full max-w-5xl mx-auto flex items-center justify-center overflow-hidden my-2"
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${
                isZoomed ? 'scale-175 sm:scale-225 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            >
              <img
                src={IMG.zoom(mainImageSrc)}
                alt={product.title}
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>

            {galleryImages.length > 1 && !isZoomed && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1);
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition active:scale-90 cursor-pointer z-10"
                  aria-label="Previous Photo"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev - 1);
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition active:scale-90 cursor-pointer z-10"
                  aria-label="Next Photo"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </>
            )}
          </div>

          <div className="w-full max-w-xl mx-auto z-20 overflow-x-auto scrollbar-hide py-1" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 justify-center">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => { setCurrentImageIndex(idx); setIsZoomed(false); }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden cursor-pointer border-2 transition shrink-0 ${
                    currentImageIndex === idx ? 'border-temu-orange scale-105 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={IMG.thumb(img)}
                    alt="Thumb"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🩹 TRUST — LivePurchaseNotification محذوف نهائياً (أسماء/مدن "VERIFIED ORDER" وهمية) */}

      {/* 🎨 SERENE_MOCKUP — Sticky CTA (.cta تاع المعاينة): عمود الإجمالي + Add + Buy
          🩹 مرفوع فوق GlassDock بـ calc(78px + safe-area) — الإجمالي كيتحدث مع الكمية
          (كيما ctaTotal تاع المعاينة) */}
      <div
        data-testid="sticky-cta"
        className={`fixed left-0 right-0 z-30 bottom-[calc(78px+env(safe-area-inset-bottom,0px))] transition-all duration-300 transform ${
          showStickyBar ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-6 opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-md mx-auto bg-white/95 backdrop-blur-xl border-t border-fog-100 shadow-[0_-10px_30px_rgba(46,64,87,0.08)] px-4 pt-2.5 pb-3 flex items-center gap-3">

          {/* cta-price — small + b (9.5px/16px تاع المعاينة) */}
          <div className="shrink-0 leading-tight">
            <small className="block text-[9.5px] font-semibold text-temu-gray-text">Total</small>
            <b className="text-base text-fog-600 tabular-nums">${(safePrice * quantity).toFixed(2)}</b>
          </div>

          <div className="flex items-center gap-2.5 flex-1">
            <button
              type="button"
              onClick={() => {
                handleAddToCart();
                setStickyAdded(true);
                setTimeout(() => setStickyAdded(false), 1200);
              }}
              className={`flex-1 font-extrabold text-[13px] uppercase tracking-wide py-3.5 px-4 rounded-2xl transition active:scale-[.97] cursor-pointer whitespace-nowrap ${
                stickyAdded
                  ? 'bg-maroccan-tea-600 text-white shadow-md shadow-maroccan-tea-600/25'
                  : 'bg-fog-100 text-fog-700 hover:bg-fog-200/70'
              }`}
            >
              {stickyAdded ? (
                <span className="flex items-center justify-center gap-1.5"><GlassIcon i="check" size="xs" /> Added</span>
              ) : (
                'Add to Cart'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                // 🩹 Tenet #31: كاتب واحد للإلحاق — نفس handleAddToCart (مع الحركة fly-to-cart)
                handleAddToCart();
                router.push('/cart');
              }}
              className="flex-1 bg-linear-to-r from-fog-600 via-fog-500 to-fog-400 text-white font-extrabold text-[13px] uppercase tracking-wide py-3.5 px-4 rounded-2xl shadow-lg shadow-fog-500/40 active:scale-[.97] transition cursor-pointer whitespace-nowrap"
            >
              Buy Now
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}