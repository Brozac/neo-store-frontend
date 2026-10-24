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
// ProductDetailsClient v1.1 — مراجعة عميقة سطر بسطر (Task 9)
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

const TABS = [
  { key: 'details', label: 'Description' },
  { key: 'materials', label: 'Materials' },
  { key: 'size', label: 'Size & Fit' },
  { key: 'shipping', label: 'Shipping & Returns' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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
  const [openAcc, setOpenAcc] = useState<TabKey | null>('details'); // ✨ SERENE — أكورديون بدل التابات (mockup .acc، الأول مفتوح)
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
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const mainCtaRef = useRef<HTMLDivElement>(null);

  const defaultImage = '/icon-512.png';

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (thumbnailsRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      thumbnailsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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
    return () => observer.disconnect();
  }, []);


  const parsePrice = (price: any) => Number(price) || 0;
  const stripHtml = (html?: string) => html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const getColorHex = (c: string) => c.startsWith('#') ? c : '#888888';
  // ✨ SERENE — حروف الأفاتار للمراجعات (mockup .rava)
  const initials = (n?: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  const safePrice = parsePrice(product.price);
  const safeOriginalPrice = parsePrice(product.original_price);
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
    <main className="min-h-screen bg-temu-offwhite pb-48 font-sans">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-12">

        {/* Breadcrumbs */}
        <div className="flex flex-col gap-2 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer active:scale-95 w-fit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back
          </button>
          <div className="text-sm text-temu-gray-light flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-fog-600 cursor-pointer">Home</Link>
            <span>/</span>
            <Link href={`/category/${product.category?.split('/')[0] || 'all'}`} className="hover:text-fog-600 cursor-pointer capitalize">
              {product.category?.split('/')[0] || 'Catalog'}
            </Link>
            <span>/</span>
            <span className="text-temu-black font-medium truncate max-w-[200px] sm:max-w-none">{product.title}</span>
          </div>
        </div>

        {/* Product Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">

          {/* ✨ SERENE V2 — المعرض المنزلق طبق الأصل من mockup (.gallery/.gtrack سطر 172-176):
              مسار واحد ينزلق بمنحنى cubic-bezier(.22,.8,.28,1) + دائرة زجاجية خلف الصورة
              + زجاج القلب العايم (.glassbtn) + نقاط داخل المعرض (.gdots) */}
          <div className="flex flex-col gap-4">
            <div
              className="relative w-full aspect-square sm:min-h-[440px] rounded-[26px] overflow-hidden bg-gradient-to-br from-fog-50 via-white to-fog-100 border border-temu-gray-border-light group touch-pan-y cursor-zoom-in shadow-[var(--sh-card)] flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => { setIsLightboxOpen(true); setIsZoomed(false); }}
            >
              {/* ✨ الدائرة الزجاجية خلف الصورة (mockup .gslide::after) */}
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[62%] aspect-square rounded-full border-[1.5px] border-white/70 bg-white/40" />

              {showVideo && product.video_url ? (
                <video src={product.video_url} controls autoPlay className="relative z-10 w-full h-full object-cover" />
              ) : (
                <div
                  className="serene-slide-ease flex h-full w-full"
                  style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                >
                  {galleryImages.map((img, idx) => (
                    <div key={idx} className="relative min-w-full h-full flex items-center justify-center">
                      <img
                        src={IMG.detail(img)}
                        srcSet={`${IMG.card(img)} 400w, ${IMG.detail(img)} 800w`}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        fetchPriority={idx === 0 ? 'high' : undefined}
                        loading={idx === 0 ? undefined : 'lazy'}
                        decoding="async"
                        alt={idx === currentImageIndex ? product.title : ''}
                        className="relative z-10 w-full h-full object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ✨ زجاج القلب العايم فوق المعرض (mockup .float-head/.glassbtn سطر 167-171) */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(product.id); }}
                className={`serene-glass absolute top-3.5 right-3.5 z-20 w-10 h-10 rounded-full grid place-items-center transition cursor-pointer active:scale-90 ${
                  isCurrentProductFavorited ? 'text-coral-500' : 'text-temu-black'
                }`}
                aria-label="Save to Wishlist"
                aria-pressed={isCurrentProductFavorited}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill={isCurrentProductFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
              </button>

              {galleryImages.length > 1 && !showVideo && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1);
                    }}
                    className="serene-glass absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center text-temu-black transition cursor-pointer z-20 active:scale-90"
                    aria-label="Previous Image"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1);
                    }}
                    className="serene-glass absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center text-temu-black transition cursor-pointer z-20 active:scale-90"
                    aria-label="Next Image"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </>
              )}

              {/* ✨ نقاط المعرض داخل الإطار (mockup .gdots bottom:40px) — 40px في الموبايل حيت الورقة كتغطي البوتوم */}
              {galleryImages.length > 1 && !showVideo && (
                <div className="absolute max-md:bottom-10 md:bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 pointer-events-none">
                  {galleryImages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentImageIndex === idx ? 'w-5 bg-fog-600' : 'w-1.5 bg-fog-300/80'
                      }`}
                    />
                  ))}
                </div>
              )}

              {!showVideo && (
                <div className="absolute top-3.5 left-3.5 z-20 bg-white/80 backdrop-blur-md text-fog-700 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm pointer-events-none">
                  Tap to Zoom
                </div>
              )}
            </div>

            <div className="relative w-full flex items-center group/thumbs">

              {galleryImages.length > 4 && (
                <button
                  type="button"
                  onClick={() => scrollThumbnails('left')}
                  className="absolute -left-2 z-10 bg-white/90 hover:bg-white text-black w-8 h-8 rounded-full shadow-md border border-gray-200 flex items-center justify-center cursor-pointer transition-all opacity-80 hover:opacity-100 active:scale-90"
                  aria-label="Scroll Left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
              )}

              <div
                ref={thumbnailsRef}
                className="flex gap-2.5 w-full overflow-x-auto p-2 scrollbar-hide touch-pan-x items-center scroll-smooth"
              >
                {product.video_url && (
                  <div
                    onClick={() => setShowVideo(true)}
                    className={`relative aspect-square w-16 sm:w-20 rounded-xl overflow-hidden cursor-pointer border-2 transition flex items-center justify-center bg-black shrink-0 ${showVideo ? 'border-fog-500' : 'border-transparent opacity-70'}`}
                  >
                    <span className="text-white text-xl"><GlassIcon ch="▶" size="xs" /></span>
                  </div>
                )}
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => { setCurrentImageIndex(idx); setShowVideo(false); }}
                    className={`relative aspect-square w-16 sm:w-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 bg-white shrink-0 ${
                      !showVideo && currentImageIndex === idx
                        ? 'border-[#5B7EA6] shadow-md ring-2 ring-[#5B7EA6]/30 scale-95'
                        : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={IMG.thumb(img)}
                      alt="Thumbnail"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                ))}
              </div>

              {galleryImages.length > 4 && (
                <button
                  type="button"
                  onClick={() => scrollThumbnails('right')}
                  className="absolute -right-2 z-10 bg-white/90 hover:bg-white text-black w-8 h-8 rounded-full shadow-md border border-gray-200 flex items-center justify-center cursor-pointer transition-all opacity-80 hover:opacity-100 active:scale-90"
                  aria-label="Scroll Right"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              )}
            </div>
          </div>

          {/* Pricing & Customization Box — ✨ SERENE: ورقة منزلقة فوق المعرض في الموبايل (mockup .pd-body سطر 178) */}
          <div className="space-y-6 max-md:relative max-md:z-10 max-md:-mt-7 max-md:rounded-t-[26px] max-md:bg-white max-md:pt-6 max-md:shadow-[0_-8px_24px_rgba(91,126,166,0.10)]">
            <div>
              {/* ✨ SERENE — صف العلامة: Marcellus + SKU (mockup .pd-toprow سطر 179-181) */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-brand text-[10.5px] text-temu-gray-text uppercase">Laclarc</span>
                <span className="text-[10px] text-temu-gray-text tracking-wider">SKU-LC-{product.id}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-temu-black tracking-tight mb-2 leading-snug">
                {product.title}
              </h1>

              {/* ✨ SERENE — سطر الميتا: نجمة ذهبية + تقييم + مبيعات + ضمان (mockup .pd-meta سطر 183-185) */}
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-4 text-[11.5px] text-temu-gray-text">
                {reviews.length > 0 ? (
                  <>
                    <span className="flex items-center gap-1 text-[#C9A96A] font-extrabold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
                      {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{realTotal} verified rating{realTotal !== 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <span className="font-semibold"><GlassIcon ch="✨" size="xs" /> New in catalog — be the first to review</span>
                )}
                {product.sales_count ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{product.sales_count}+ sold</span>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                <span>30-Day Returns</span>
              </div>

              {/* ✨ SERENE — صف السعر: أزرق عميق 22px + مشطوب + شارة الوردي (mockup .pd-price/.off سطر 186-189) */}
              <div className="flex items-baseline gap-2.5 mb-6">
                <span className="text-[22px] leading-none font-black text-fog-600">${safePrice.toFixed(2)}</span>
                {safeOriginalPrice > safePrice && (
                  <>
                    <span className="text-[13px] text-temu-gray-light line-through">${safeOriginalPrice.toFixed(2)}</span>
                    <span className="bg-coral-500/15 text-coral-600 text-[10.5px] font-extrabold px-2 py-1 rounded-full">{discountPct}% OFF</span>
                  </>
                )}
              </div>

              {variantEngine.groups.length > 1 && (
                <div className="mb-6">
                  <label className="block text-xs uppercase font-extrabold text-temu-black mb-2">
                    Color: <span className="text-temu-gray-text font-semibold">{selectedGroup?.name}</span>
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {variantEngine.groups.map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => setSelectedColorName(g.name)}
                        title={g.name}
                        aria-label={`Color ${g.name}`}
                        aria-pressed={selectedGroup?.name === g.name}
                        className={`relative w-11 h-11 rounded-full overflow-hidden transition cursor-pointer border-2 border-transparent active:scale-90 ${
                          selectedGroup?.name === g.name
                            ? 'serene-swatch-ring'
                            : 'hover:ring-2 hover:ring-fog-200'
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
                          <span style={{ backgroundColor: getColorHex(g.hex || g.name) }} className="block w-full h-full rounded-full border border-black/10"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* fallback قديم — بلا variants صالحين: دوائر hex كيما قبل (بلا أثر على الـ vid) */}
              {variantEngine.groups.length <= 1 && product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs uppercase font-extrabold text-temu-black mb-2">
                    Color: <span className="text-temu-gray-text font-semibold">{selectedColorName || product.colors[0]}</span>
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {product.colors.map((col, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedColorName(col)}
                        className={`w-9 h-9 rounded-full transition cursor-pointer border-2 border-transparent active:scale-90 ${selectedColorName === col ? 'serene-swatch-ring' : 'hover:ring-2 hover:ring-fog-200'}`}
                      >
                        <span style={{ backgroundColor: getColorHex(col) }} className="block w-full h-full rounded-full border border-black/10"></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableSizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-extrabold text-temu-black">Size</label>
                    <button type="button" onClick={() => setOpenAcc('size')} className="text-xs text-fog-600 font-bold cursor-pointer hover:underline">
                      Size Guide <GlassIcon ch="↗" size="xs" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`min-w-[46px] h-[38px] px-3.5 rounded-[13px] font-bold text-[12.5px] transition cursor-pointer border border-transparent active:scale-95 ${
                          effectiveSize === sz
                            ? 'bg-fog-600 text-white shadow-[var(--sh-btn)]'
                            : 'bg-[#EDF3F8] text-temu-gray-text hover:bg-fog-100'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA Controls */}
            <div ref={mainCtaRef} className="space-y-4 pt-2 border-t border-gray-200">
              {/* 🩹 TRUST — Flash timer فقط للعرضات الممولة الحقيقية (is_sourced) — لا إلحاح وهمي على كل منتج */}
              {product.is_sourced === true && <CountdownTimer />}
              <DeliveryEstimator productId={product.id} />

              <div className="space-y-2.5 my-6">
                {/* 🩹 P0 مالي: "Bundle Savings" كان خصم وهمي — كيتعرض فالسلة ويختفى فالـ checkout */}
                <label className="block text-xs uppercase font-black text-gray-800 tracking-wider">
                  <GlassIcon i="zap" size="xs" /> Quantity:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setQuantity(1)}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity === 1
                        ? 'border-[#5B7EA6] bg-fog-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-gray-900">Standard</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity === 1 ? 'border-[#5B7EA6] bg-[#5B7EA6]' : 'border-gray-300'}`}>
                        {quantity === 1 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 1 Unit</span>
                    <span className="text-sm font-black text-gray-900 mt-1">${safePrice.toFixed(2)}</span>
                  </div>

                  <div
                    onClick={() => setQuantity(2)}
                    className={`relative p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity === 2
                        ? 'border-[#5B7EA6] bg-fog-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-[#5B7EA6]">Duo</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity === 2 ? 'border-[#5B7EA6] bg-[#5B7EA6]' : 'border-gray-300'}`}>
                        {quantity === 2 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 2 Units</span>
                    <span className="text-sm font-black text-fog-600 mt-1">${(safePrice * 2).toFixed(2)}</span>
                  </div>

                  <div
                    onClick={() => setQuantity(3)}
                    className={`relative p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity >= 3
                        ? 'border-[#5B7EA6] bg-fog-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-maroccan-tea-600">Trio</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity >= 3 ? 'border-[#5B7EA6] bg-[#5B7EA6]' : 'border-gray-300'}`}>
                        {quantity >= 3 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 3 Units</span>
                    <span className="text-sm font-black text-maroccan-tea-600 mt-1">${(safePrice * 3).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex-1 text-white font-black py-4 px-6 rounded-full transition flex items-center justify-center gap-3 text-base cursor-pointer active:scale-[.96] shadow-[var(--sh-btn)] ${
                    mainAdded
                      ? 'bg-maroccan-tea-600 shadow-maroccan-tea-600/20'
                      : 'bg-linear-to-br from-fog-500 to-fog-600'
                  }`}
                >
                  {mainAdded ? (
                    <><span><GlassIcon i="check" size="xs" /></span> Added to Bag — View Cart <GlassIcon i="arrowRight" size="xs" /></>
                  ) : (
                    <>Add to Cart</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(product.id)}
                  className={`w-14 h-14 shrink-0 flex items-center justify-center border-2 rounded-temu-sm transition cursor-pointer active:scale-90 ${isCurrentProductFavorited ? 'border-temu-error bg-temu-error text-white' : 'border-temu-gray-border bg-white text-temu-gray-text hover:text-temu-error'}`}
                  aria-label="Save to Wishlist"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isCurrentProductFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
                </button>
              </div>

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

              {/* 🩹 TRUST — بلوك "48 shoppers" المحذوف نهائياً (كان purchaseCount عشوائي 18-120 متقلب
                  + Static Avatars من Unsplash) — البديل الحقيقي: sold_count من DB — Backlog */}

              <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] text-temu-gray-text font-semibold border-t border-temu-gray-border-light">
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
            </div>
          </div>
        </div>

        {/* ✨ SERENE — أكورديون بدل التابات (mockup .acc سطر 204-210):
            سهم يدور 180° + grid-rows للتمدد السلس — الوصف مفتوح بعمده */}
        <div className="border-t border-temu-gray-border-light pt-8">
          <div className="space-y-3">
            {TABS.map((tab) => {
              const open = openAcc === tab.key;
              return (
                <div
                  key={tab.key}
                  className={`border rounded-2xl bg-white overflow-hidden transition-colors duration-200 ${
                    open ? 'border-fog-300' : 'border-temu-gray-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenAcc(open ? null : tab.key)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-[13px] font-bold text-temu-black cursor-pointer"
                    aria-expanded={open}
                  >
                    {tab.label}
                    <svg
                      className={`w-3.5 h-3.5 text-temu-gray-light transition-transform duration-300 shrink-0 ${open ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 text-[12.5px] text-temu-gray-text leading-loose">
                        {tab.key === 'details' && (
                          <div>
                            <p className="mb-3">{stripHtml(product.description) || 'Full specifications available — contact support for any question.'}</p>
                            {detailBullets.length > 0 && (
                              <ul className="space-y-1.5 list-disc list-inside">
                                {detailBullets.map((b, i) => <li key={i}>{b}</li>)}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* 🩹 M#45: "hypoallergenic" = وعد صحي بلا مصدر على منتجات بلا بيانات */}
                        {tab.key === 'materials' && (
                          <p>{product.material || 'Material specifications not provided by the supplier — contact support for details.'}</p>
                        )}

                        {tab.key === 'size' && (
                          <p>Standard fit. Order your typical size. Detailed guide available upon request from support.</p>
                        )}

                        {tab.key === 'shipping' && (
                          <div className="space-y-2">
                            {/* ⚠️ M#45 backlog (توثيق — قرار المالك): "insured" بلا سند + "24–48h"
                                خاصو يتقاطع مع predictDelivery الحقيقي (shipTruth median) */}
                            <p>Worldwide insured delivery. Shipped in 24–48 hours directly via CJ Dropshipping.</p>
                            <p className="text-xs text-temu-gray-light">Typical transit time: 7–15 business days depending on destination country.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <FrequentlyBoughtTogether
            currentProduct={product}
            relatedProducts={relatedProducts}
          />
        )}

        {/* You May Also Like */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-temu-gray-border-light pt-10">
            <h2 className="text-lg font-black text-temu-black mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <TiltCard key={p.id}>
                  <Link href={`/products/${p.id}`} className="group flex flex-col h-full bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden active:scale-95 transition">
                    <div className="relative aspect-square overflow-hidden bg-gray-50">
                      <img
                        src={IMG.card(p.image_url || p.image || defaultImage)}
                        alt={p.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-2 transition group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3 pt-2 flex flex-col justify-between flex-1">
                      <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-1 group-hover:text-fog-600">{p.title}</h3>
                      <p className="text-fog-600 font-extrabold text-sm">${parsePrice(p.price).toFixed(2)}</p>
                    </div>
                  </Link>
                </TiltCard>
              ))}
            </div>
          </div>
        )}

        {/* Customer Reviews — 🩹 TRUST: مراجعات حقيقية فقط (بعد تنضيف 237,627 وهمية) */}
        <div className="border-t border-temu-gray-border-light pt-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-temu-black">Customer Reviews ({realTotal})</h2>
            {reviews.length > 0 && (
              <span className="text-xs font-bold text-temu-green"><GlassIcon i="check" size="xs" /> Verified Purchases</span>
            )}
          </div>

          {/* ⭐ [cj-reviews v2] — فلتر النجوم بعدادات حية (الكل + 5★…1★) */}
          {reviews.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button
                onClick={() => { setStarFilter(0); setVisibleReviews(REVIEWS_PAGE); }}
                className={starFilter === 0
                  ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-fog-600 text-white shadow-[0_6px_14px_rgba(70,100,138,0.30)] transition-all duration-200'
                  : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-temu-gray-text border border-temu-gray-border hover:border-fog-300 hover:text-fog-600 transition-all duration-200'}
              >
                All ({realTotal})
              </button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  onClick={() => { setStarFilter(s); setVisibleReviews(REVIEWS_PAGE); }}
                  className={starFilter === s
                    ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-fog-600 text-white shadow-[0_6px_14px_rgba(70,100,138,0.30)] transition-all duration-200'
                    : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-temu-gray-text border border-temu-gray-border hover:border-fog-300 hover:text-fog-600 transition-all duration-200'}
                >
                  {s}★ ({starCounts[s]})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {shownReviews.map((rev) => (
              <div key={rev.id} className="p-4 bg-white rounded-2xl border border-temu-gray-border shadow-[var(--sh-card)] flex gap-3">
                {/* ✨ SERENE — أفاتار الحروف (mockup .rava سطر 212) */}
                <div className="w-9 h-9 rounded-full bg-fog-100 text-fog-700 grid place-items-center font-extrabold text-xs shrink-0">
                  {initials(rev.author)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-xs text-temu-black truncate">
                      {rev.author} <span className="font-medium text-temu-gray-light">({rev.country || 'Verified Buyer'})</span>
                    </span>
                    <span className="text-[#C9A96A] text-[10.5px] tracking-[1px] shrink-0">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-[11.5px] text-temu-gray-text leading-relaxed mt-1">{rev.content}</p>

                  {rev.images && Array.isArray(rev.images) && rev.images.length > 0 && (
                    <div className="flex gap-2 pt-1.5">
                      {rev.images.map((photoUrl, pIdx) => (
                        <div
                          key={pIdx}
                          className="relative w-14 h-14 rounded-xl overflow-hidden border border-temu-gray-border bg-fog-50 cursor-pointer hover:scale-105 transition"
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

                  <span className="text-[10px] text-temu-gray-light block font-mono mt-1.5">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ⭐ [cj-reviews v2] — حالة خاوية للفلتر النشيط */}
          {reviews.length > 0 && filteredReviews.length === 0 && (
            <div className="text-center py-10 mb-8 border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
              No reviews with this star rating yet.
            </div>
          )}

          {/* ⭐ [cj-reviews v2] — Load more + العدد المتبقي */}
          {filteredReviews.length > shownReviews.length && (
            <div className="flex flex-col items-center gap-2 mb-8">
              <button
                onClick={() => setVisibleReviews(c => c + REVIEWS_PAGE)}
                className="px-8 py-3 rounded-full text-sm font-black bg-linear-to-br from-fog-500 to-fog-600 text-white shadow-[var(--sh-btn)] active:scale-[.97] transition-all duration-300 cursor-pointer"
              >
                Load more reviews ({filteredReviews.length - shownReviews.length} more)
              </button>
              {reviewsMeta?.hasMore && (
                <span className="text-[11px] text-gray-400">
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
                    currentImageIndex === idx ? 'border-fog-500 scale-105 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'
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

      {/* 🎨 SERENE V2 — Sticky CTA طبق الأصل من mockup .cta (سطر 216-220):
          بلوك الإجمالي (الإجمالي + السعر) + زر أساسي متدرج · مرفوع فوق GlassDock */}
      <div
        className={`fixed left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-temu-gray-border shadow-[0_-8px_24px_rgba(91,126,166,0.10)] px-4 pt-2.5 pb-3 bottom-[calc(78px+env(safe-area-inset-bottom,0px))] transition-all duration-300 transform ${
          showStickyBar ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-6 opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">

          {/* ✨ بلوك الإجمالي الحي (mockup .cta-price) — كيتبدل مع الكمية */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
            className="flex flex-col items-start leading-tight shrink-0 cursor-pointer"
            title="Tap to review choices"
          >
            <span className="text-[9.5px] font-semibold text-temu-gray-text uppercase tracking-wide">Total</span>
            <b className="text-base text-fog-600">${(safePrice * quantity).toFixed(2)}</b>
            <span className="text-[9px] text-temu-gray-light max-w-[110px] truncate">
              {[selectedGroup?.name || selectedColorName, effectiveSize].filter(Boolean).join(' · ') || `${quantity} unit${quantity > 1 ? 's' : ''}`}
            </span>
          </button>

          {/* ✨ الزر الأساسي المتدرج (mockup .btn-primary: 135° primary→deep) */}
          <button
            type="button"
            onClick={() => {
              // 🩹 Tenet #31: كاتب واحد للإلحاق — نفس handleAddToCart (مع الحركة fly-to-cart)
              handleAddToCart();
              setStickyAdded(true);
              setTimeout(() => setStickyAdded(false), 1200);
            }}
            className={`flex-1 text-white font-black text-[14px] py-3.5 px-5 rounded-full transition active:scale-[.96] cursor-pointer shadow-[var(--sh-btn)] flex items-center justify-center gap-2 whitespace-nowrap ${
              stickyAdded ? 'bg-maroccan-tea-600' : 'bg-linear-to-br from-fog-500 to-fog-600'
            }`}
          >
            {stickyAdded ? (
              <span className="flex items-center justify-center gap-1.5"><GlassIcon i="check" size="xs" /> Added — in your cart</span>
            ) : (
              <>Add to Cart</>
            )}
          </button>

          {/* ✨ الشراء السريع — مسار الدفع المباشر محفوظ ( أيقونة مدمجة كيما .glassbtn) */}
          <button
            type="button"
            onClick={() => {
              handleAddToCart();
              router.push('/checkout');
            }}
            className="shrink-0 w-12 h-12 rounded-full bg-fog-100 text-fog-700 grid place-items-center cursor-pointer active:scale-90 transition hover:bg-fog-200/70"
            aria-label="Buy Now — go to checkout"
            title="Buy Now"
          >
            <GlassIcon i="zap" size="sm" />
          </button>

        </div>
      </div>
    </main>
  );
}