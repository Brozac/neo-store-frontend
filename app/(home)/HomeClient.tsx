'use client';

import { useEffect, useState, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '../components/ProductCard';
import LightningDeals from '../components/LightningDeals';
import HeroSection from '../components/HeroSection';
import dynamic from 'next/dynamic';

// 🚀 PERF (Task 20) — Reels تحتها الـ fold = lazy (كيتحمّل غير ملي يوصلو الزائر)
const ShoppableReels = dynamic(() => import('../components/ShoppableReels'), {
  loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-2xl" />,
});
import { IMG } from '@/lib/imageOptimizer';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';
import { useSiteConfig } from '../components/SiteConfigProvider';
import { isCategoryHidden } from '@/lib/siteConfig';
import FilterSortDrawer, { type DrawerSection } from '../components/FilterSortDrawer';
import { COLOR_FACETS, COLOR_SWATCHES } from '@/lib/filterSort';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'discount' | 'newest';
type PriceRangeOption = 'all' | 'under15' | '15to35' | 'above35';

const PER_PAGE = 24;

// ═══ F#60 — الفلترة والفرز في الهوم عبر دروار all-products (نفس المكون، نفس الوجهة) ═══
// المالك: «Filter and sort مابانتش في الموقع» — الدروار كان حي في /all-products
// والفئات ولكن الهوم ما كانش فيه حتى زر «Filter and sort» — هنا كنركّبو بنفس المكون.
// البنية: applied = المطبق على الـ grid · draft = المسودة داخل الدروار (نمط الديمو).
interface HomeFilterState {
  sortBy: SortOption;
  priceRange: PriceRangeOption;
  colours: string[];
}
const HOME_DEFAULT_FILTERS: HomeFilterState = { sortBy: 'default', priceRange: 'all', colours: [] };

// خيارات الفرز تاع الهوم — نفس قائمة الـ select القديم بالحرف (+discount اللي كانت فيه)
const HOME_SORTS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Top Recommendations' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Biggest Discounts' },
  { value: 'newest', label: 'Newest Arrivals' },
];

// نطاقات السعر تاع الهوم — نفس البيلز القديمة (Under $15 / $15–$35 / $35+) بالحرف
const HOME_PRICE_BANDS: { value: PriceRangeOption; label: string }[] = [
  { value: 'under15', label: 'Under $15' },
  { value: '15to35', label: '$15 to $35' },
  { value: 'above35', label: 'Over $35' },
];

/** واش المنتج داخل في نطاق السعر تاع الهوم — FIX-ZERO: بلا سعر = بلا وعد زائف */
function homePassesPrice(p: { price?: unknown }, band: PriceRangeOption): boolean {
  const price = Number(p?.price) || 0;
  if (band === 'all') return true;
  if (price <= 0) return false;
  if (band === 'under15') return price < 15;
  if (band === '15to35') return price >= 15 && price <= 35;
  return price > 35; // above35
}

/** عدّاد الفاسيت تاع السعر — فوق المحمل، مستقل على الاختيار الحالي (نمط الديمو) */
function countHomePrice(products: { price?: unknown }[], band: PriceRangeOption): number {
  return products.reduce((acc, p) => (homePassesPrice(p, band) ? acc + 1 : acc), 0);
}

/** 🎨 مطابقة اللون كلاينت-سايد على swatches الـ payload ({c,i,v}):
 *  «White» كتضرب أي swatch كيحتويها (نفس دلالة ILIKE تاع السيرفر في Phase 2).
 *  منتوج بلا داتا لون = ما كيماطش فيلتر لون (صدق — بلا كذب) */
function matchesColour(product: { swatches?: unknown }, colours: string[]): boolean {
  if (colours.length === 0) return true;
  const names: string[] = Array.isArray(product?.swatches)
    ? (product.swatches as { c?: string }[]).map((s) => String(s?.c || '').toLowerCase()).filter(Boolean)
    : [];
  if (names.length === 0) return false;
  return colours.some((c) => names.some((n) => n.includes(c.toLowerCase())));
}

// ✨ Per-page shuffle: deterministic per (seed, page) — session freshness,
//    stable appends (loaded pages never re-order — Temu-style scroll stability)
function shufflePage(arr: any[], pageNum: number, seed: number | null) {
  if (!seed || arr.length < 2) return arr;
  const list = [...arr];
  let s = (seed + pageNum * 7919) | 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const categoryQuery = searchParams.get('category') || '';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const [dealsProducts, setDealsProducts] = useState<any[]>([]);
  const [categoryStructure, setCategoryStructure] = useState<any[]>([{ name: 'All', slug: 'all' }]);

  const [activeCategory, setActiveCategory] = useState(categoryQuery || 'All');
  const [activeTrendingId, setActiveTrendingId] = useState<string | null>(null);
  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);
  const [showReels, setShowReels] = useState(true);

  // 👁️ F#93 — كونفيگ الظهور (fail-open: null = كلشي ظاهر)
  const { cfg } = useSiteConfig();
  const sec = cfg?.sections;
  const hiddenCats = cfg?.hiddenCategories;

  // ═══ F#60 — حالة الفلترة (draft/applied كيما all-products) ═══
  const [applied, setApplied] = useState<HomeFilterState>(HOME_DEFAULT_FILTERS);
  const [draft, setDraft] = useState<HomeFilterState>(HOME_DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // 🆕 إدارة التركيز تاع الشيبس (نمط الديمو — نفس all-products)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusNext = useRef<number | 'opener' | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    const i = focusNext.current;
    focusNext.current = null;
    if (i === 'opener') {
      openerRef.current?.focus();
      return;
    }
    const left = chipRefs.current.filter(Boolean);
    (left[i] ?? left[i - 1] ?? openerRef.current)?.focus();
  });

  // ═══ Search branch state (البحث خارج الـ hook — نتائج حتى 200 بلا pagination) ═══
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchGenRef = useRef(0);                 // 🛡️ سباقات البحث السريعة (gen محلي — الـ hook عندو gen ديالو)

  // 🔄 ROTATE-V1 — seed جديد في كل زيارة (كان sessionStorage catalog_seed ثابت
  //    للجلسة كاملة — طلب المالك: «المنتجات نحوسهم كل مرة يتبدلو تدخل تخرج
  //    يطلعوا منتجات جديدة») — SSR-safe: typeof window guard, Tenet #2
  const [shuffleSeed] = useState<number | null>(() => {
    if (typeof window === 'undefined') return 1;
    return Math.floor(Math.random() * 1_000_000);
  });

  // 🔄 ROTATE-V1 — كل زيارة كتبدا من صفحة عشوائية من الكتالوج وتلف عليه بالكامل:
  //    virtual page v من K صفحات → real page ((offset + v - 1) % K) + 1
  //    = المنتجات كيدخلو وكيخرجو كل زيارة، بلا تكرار داخل الزيارة، والسكرول
  //    اللانهائي كيغطي الكتالوج كامل (fail-open: بلا عدّاد = السلوك القديم)
  const mapPage = useCallback((v: number, K: number) => {
    if (!shuffleSeed || K <= 1) return v;
    const offset = shuffleSeed % K;
    return ((offset + v - 1) % K) + 1;
  }, [shuffleSeed]);

  const categoriesReady = categoryStructure.length > 1;
  const isBrowsing = !searchQuery; // browse feed vs server search results

  // ═══ v5.1 — الكاتب الوحيد للـ browse feed (Tenet #31) ═══
  // أول صفحة · infinite scroll · dedup · mutex · gen · عدّاد — كلهم في lib/useInfiniteFeed.ts
  // الباغات المكتشفة (تكرار page=1 · observer الميت · السباقات) عالجة مرة وحدة في الكاتب.
  const feed = useInfiniteFeed<any>(
    `${activeCategory}|${categoriesReady}`,
    isBrowsing && (activeCategory === 'All' || categoriesReady),
    {
      buildPageUrl: (page: number) => {
        const slug = categoryStructure.find(c => c.name === activeCategory)?.slug;
        return activeCategory !== 'All'
          ? `${API_URL}/api/products?category=${encodeURIComponent(slug || activeCategory)}&page=${page}`
          : `${API_URL}/api/products?page=${page}`;
      },
      buildCountUrl: () => {
        if (activeCategory !== 'All' && !categoriesReady) return '';   // نستنى slug map (race kill)
        const cat = activeCategory !== 'All'
          ? `&category=${encodeURIComponent(categoryStructure.find(c => c.name === activeCategory)?.slug || activeCategory)}`
          : '';
        return `${API_URL}/api/products?count=1${cat}`;
      },
      perPage: PER_PAGE,
      rootMargin: '800px',                                          // نفس السلوك الاستباقي ديال v5
      shuffle: (arr, pageNum) => shufflePage(arr, pageNum, shuffleSeed),
      mapPage,                                                      // 🔄 ROTATE-V1 — كل زيارة = كتالوج مختلف
    }
  );

  // مصدر العرض الموحد — browse من الكاتب الوحيد · search من الفرع المحلي
  const products = isBrowsing ? feed.products : searchResults;
  const loading = isBrowsing ? feed.loading : searchLoading;

  // ── Categories (rail v4) + Deals + Settings — مرة وحدة ──
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/products/deals`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/categories`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/settings`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([dealsData, categoriesData, settingsData]) => {
      if (Array.isArray(dealsData)) setDealsProducts(dealsData);
      if (Array.isArray(categoriesData)) {
        const mainCategories = categoriesData.map((cat: any) => ({ name: cat.name, slug: cat.slug, image_url: cat.image_url }));
        // Rail v4: L1 (بالصور) + L2 (بمسارات slug كاملة) — Temu-style depth
        const allRailCats: any[] = [...(mainCategories || [])];
        const walkRail = (nodes: any[], parentPath: string, depth: number) => (nodes || []).forEach((n: any) => {
          const fullPath = parentPath ? `${parentPath}/${n.slug}` : n.slug;
          if (depth === 1 && n.name && !allRailCats.some((x: any) => x.name === n.name)) {
            allRailCats.push({ name: n.name, slug: fullPath, image_url: n.image_url });
          }
          if (n.children?.length) walkRail(n.children, fullPath, depth + 1);
        });
        walkRail(mainCategories, '', 0);
        setCategoryStructure([{ name: 'All', slug: 'all' }, ...allRailCats]);
      }
      if (settingsData && (settingsData as any).show_reels === false) setShowReels(false);
    });
  }, [API_URL]);

  useEffect(() => {
    setActiveCategory(categoryQuery || 'All');
  }, [categoryQuery]);

  // ═══ البحث — server-side (فرع search الحي — حتى 200 نتيجة) ═══
  // 🩹 v5.1: كيب لـ searchResults (الـ hook مجمد حينما disabled) + gen محلي مستقل
  useEffect(() => {
    if (!searchQuery) return;
    const gen = ++searchGenRef.current;
    const controller = new AbortController();
    setSearchLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/products?search=${encodeURIComponent(searchQuery)}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (gen !== searchGenRef.current) return;
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error('[home-search]', err);
      } finally {
        if (gen === searchGenRef.current) setSearchLoading(false);
      }
    })();

    return () => controller.abort();
  }, [searchQuery, API_URL]);

  // ✨ Trending (آلات الحلاقة أولاً + Fallback)
  const trendingProducts = useMemo(() => {
    if (products.length === 0) return [];
    const visible = products.filter((p) => !isCategoryHidden(p.category, hiddenCats)); // 👁️ F#93
    const shavers = visible.filter(p =>
      p.category?.startsWith('shavers') ||
      p.title?.toLowerCase().includes('shaver') ||
      p.title?.toLowerCase().includes('clipper') ||
      p.title?.toLowerCase().includes('trimmer')
    );
    if (shavers.length > 0) return shavers.slice(0, 5);
    return visible.slice(0, 5);
  }, [products, hiddenCats]);

  // ✨ فلترة client-side: price + colour (+ category safety net — السيرفر فلتر أصلاً)
  //    ⚠️ matchesSearch تحيدت: البحث ولّى server-side (والـ SELECT ما فيهش description —
  //    الفلتر client كان كيحذف نتائج صحيحة مطابقة بالوصف — bug صامت مقفول)
  //    🆕 F#60 — اللون دخل الفلترة (matchesColour على swatches الـ payload) +
  //    FIX-ZERO عبر homePassesPrice (بلا سعر = ما كيدخل حتى نطاق)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (isCategoryHidden(product.category, hiddenCats)) return false; // 👁️ F#93 — الأقسام المخفية من كل الخلاصات
      let matchesCategory = true;
      if (activeCategory !== 'All') {
        const pCat = (product.category || '').toLowerCase();
        const activeCatObj = categoryStructure.find(c => c.name === activeCategory);
        const targetSlug = (activeCatObj?.slug || activeCategory).toLowerCase();
        matchesCategory = pCat === targetSlug || pCat.startsWith(targetSlug + '-') || pCat.startsWith(targetSlug + '/');
      }
      if (!matchesCategory) return false;
      if (!matchesColour(product, applied.colours)) return false; // 🎨 F#60
      return homePassesPrice(product, applied.priceRange);
    });
  }, [products, activeCategory, categoryStructure, applied.priceRange, applied.colours, hiddenCats]);

  // ✨ Sorting Engine (client — على المحمّل)
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (applied.sortBy === 'price-asc') return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    if (applied.sortBy === 'price-desc') return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (applied.sortBy === 'discount') {
      return list.sort((a, b) => {
        const discA = Number(a.original_price) > Number(a.price)
          ? (Number(a.original_price) - Number(a.price)) / Number(a.original_price) : 0;
        const discB = Number(b.original_price) > Number(b.price)
          ? (Number(b.original_price) - Number(b.price)) / Number(b.original_price) : 0;
        return discB - discA;
      });
    }
    if (applied.sortBy === 'newest') return list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return list;
  }, [filteredProducts, applied.sortBy]);

  // ═══ F#60 — handlers ديال الدروار (draft/applied كيما الديمو) ═══
  const openDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(true); }, [applied]);
  const dismissDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(false); }, [applied]);
  const applyDrawer = useCallback(() => { setApplied(draft); setDrawerOpen(false); }, [draft]);
  const toggleDraftSort = useCallback((v: string) => setDraft((d) => ({ ...d, sortBy: v as SortOption })), []);
  const toggleDraftPrice = useCallback((v: string) => setDraft((d) => ({ ...d, priceRange: v as PriceRangeOption })), []);
  const toggleDraftColour = useCallback(
    (v: string) => setDraft((d) => ({ ...d, colours: d.colours.includes(v) ? d.colours.filter((x) => x !== v) : [...d.colours, v] })),
    []
  );
  // مسح داخل المسودة — الفرز كيبقى (sort ماشي فيلتر — نفس فلسفة all-products)
  const clearDraft = useCallback(() => setDraft((d) => ({ ...d, priceRange: 'all', colours: [] })), []);
  const clearAllFilters = useCallback(() => {
    setApplied((prev) => {
      const next = { ...prev, sortBy: 'default' as SortOption, priceRange: 'all' as PriceRangeOption, colours: [] };
      setDraft(next);
      return next;
    });
  }, []);

  // ═══ F#60 — أقسام الدروار: Sort + Price + Colour (الفئة عند الريل تاع الهوم،
  //   المقاس ما عندناش داتا كلاينت عليه — بلا وعد مزيف) ═══
  const sections = useMemo<DrawerSection[]>(() => [
    {
      key: 'sort',
      title: 'Sort by',
      type: 'radio',
      summary: HOME_SORTS.find((s) => s.value === draft.sortBy)?.label ?? 'Top Recommendations',
      options: HOME_SORTS.map((s) => ({ value: s.value, label: s.label })),
      selected: [draft.sortBy],
      onToggle: toggleDraftSort,
    },
    {
      key: 'price',
      title: 'Price',
      type: 'radio',
      summary: draft.priceRange === 'all'
        ? 'Any price'
        : (HOME_PRICE_BANDS.find((b) => b.value === draft.priceRange)?.label ?? 'Any price'),
      options: HOME_PRICE_BANDS.map((b) => {
        const c = countHomePrice(products, b.value);
        return { value: b.value, label: b.label, count: c, disabled: c === 0 && draft.priceRange !== b.value };
      }),
      selected: [draft.priceRange],
      onToggle: toggleDraftPrice,
    },
    {
      key: 'colour',
      title: 'Colour',
      type: 'swatch',
      defaultFolded: true,
      summary: draft.colours.length ? draft.colours.join(', ') : 'Any',
      options: COLOR_FACETS.map((c) => {
        const cnt = products.filter((p) => matchesColour(p, [c])).length;
        return { value: c, label: c, swatch: COLOR_SWATCHES[c], count: cnt, disabled: cnt === 0 && !draft.colours.includes(c) };
      }),
      selected: draft.colours,
      onToggle: toggleDraftColour,
    },
  ], [draft, products, toggleDraftSort, toggleDraftPrice, toggleDraftColour]);

  // زر التطبيق — العد صادق فوق المحمل (كلشي كلاينت في الهوم — لا refetch ولا مجهول)
  const draftMatches = useMemo(
    () => products.filter((p) => matchesColour(p, draft.colours) && homePassesPrice(p, draft.priceRange)).length,
    [products, draft.colours, draft.priceRange]
  );

  // ═══ F#60 — الشيبس: كل فيلتر مطبق = شيب كيحيد راسو بضغطة ═══
  const chips = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (applied.priceRange !== 'all') {
      list.push({
        key: 'price',
        label: HOME_PRICE_BANDS.find((b) => b.value === applied.priceRange)?.label ?? 'Price',
        onRemove: () => setApplied((prev) => ({ ...prev, priceRange: 'all' })),
      });
    }
    for (const c of applied.colours) {
      list.push({
        key: `colour-${c}`,
        label: c,
        onRemove: () => setApplied((prev) => ({ ...prev, colours: prev.colours.filter((x) => x !== c) })),
      });
    }
    return list;
  }, [applied.priceRange, applied.colours]);

  const activeCount = (applied.priceRange !== 'all' ? 1 : 0) + applied.colours.length;
  const hasActiveFilters = applied.sortBy !== 'default' || activeCount > 0;

  // 🩹 F#60 — الباغ القاتل: الـ grid كان كيقرا products الخام حتى مع فلاتر نشطة
  // (rotate 1d5b2f0 كان عمّر sortfix fd420c2) — الفرز/السعر/اللون ما كانو ما كيتبدلش والو بالعين.
  // الفلاتر نشطة → sortedProducts (المفلتر/المرتب) · default → raw rotate feed (ROTATE-V1 مستقر)
  const gridProducts = hasActiveFilters ? sortedProducts : products;

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans relative pt-4">
      <div className="max-w-7xl mx-auto px-4">

        {/* 1. Hero Section — 📱 [mmobile-hide 2026-11-06 (طلب المالك):
            الهاتف (<640px) ما يشارفهوش · التابلت/الكمبيوتر (640px+) عادي.
            CSS صافي (hidden sm:block) — بلا JS، صفر flicker، والـ DOM/SEO كامل */}
        {sec?.hero !== false && activeCategory === 'All' && searchQuery === '' && (
          <div className="hidden sm:block">
            <HeroSection trendingProducts={trendingProducts} />
          </div>
        )}

        {/* 2. Categories Bar — Temu-style rail */}
        {sec?.categoriesRail !== false && (
        <div id="catalog" className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide touch-pan-x">
          {categoryStructure
            .filter((cat) => cat.slug === 'all' || !isCategoryHidden(cat.slug, hiddenCats)) // 👁️ F#93
            .map((cat) => {
            const isActive = activeCategory === cat.name;
            const label = cat.name === 'Shavers' ? 'Electric Grooming' : cat.name;
            const img = cat.image_url ? IMG.thumb(cat.image_url) : null;
            return (
              <button
                key={cat.slug || cat.name}
                onClick={() => {
                  setActiveCategory(cat.name);
                  // F#60 — تبديل الفئة كيمسح الفلاتر (نفس سلوك البيلز القديمة)
                  setApplied((prev) => ({ ...prev, priceRange: 'all', colours: [] }));
                  setDraft((prev) => ({ ...prev, priceRange: 'all', colours: [] }));
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-20 group cursor-pointer active:scale-95 transition touch-manipulation"
              >
                <div className={`relative w-16 h-16 rounded-full overflow-hidden bg-white ring-2 transition-all duration-300
                                 ${isActive ? 'ring-[#5F8271] shadow-md' : 'ring-transparent group-hover:ring-[#5F8271]/40'}`}>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-[#5F8271]/70">
                    {cat.name === 'All' ? '🛍️' : (label?.[0] || '?')}
                  </span>
                  {img && (
                    <img
                      src={img}
                      alt={label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  )}
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight line-clamp-2 transition-colors
                                  ${isActive ? 'text-temu-green' : 'text-temu-black'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {/* 3. Lightning Deals */}
        {sec?.deals !== false && activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && (
          <div className="mb-6">
            {/* 👁️ F#93 — منتجات الأقسام المخفية خارج العروض */}
            <LightningDeals products={dealsProducts.filter((p) => !isCategoryHidden(p.category, hiddenCats))} />
          </div>
        )}

        {/* 4. Shoppable Reels — مزدوج: كونفيگ الظهور + مفتاح الباك show_reels */}
        {sec?.reels !== false && showReels && activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && (
          <div className="mb-8 mt-6">
            <ShoppableReels products={products} />
          </div>
        )}

        {/* 5. Trending Now — 📱 [mmobile-hide 2026-11-06 (طلب المالك): مخبي في الهاتف
            (<640px) · التابلت/الكمبيوتر كيشارفوه عادي — نفس سلوك Task 22 القديم */}
        {sec?.trending !== false && activeCategory === 'All' && searchQuery === '' && !hasActiveFilters && trendingProducts.length > 0 && (
          <div className="hidden sm:block mb-8 mt-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-black text-temu-black flex items-center gap-2">
                <span>🔥</span> Trending Now
              </h2>
              <span className="text-xs text-temu-orange font-bold cursor-pointer active:scale-95 transition-transform">
                Top Picks
              </span>
            </div>

            <div
              className="t-accordion-container"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.t-accordion-card');
                  if (card) {
                    setActiveTrendingId(card.getAttribute('data-product-id'));
                  } else {
                    setActiveTrendingId(null);
                  }
                }
              }}
              onTouchEnd={() => setActiveTrendingId(null)}
            >
              {trendingProducts.map((product) => {
                const safePrice = Number(product.price) || 0;
                const img = IMG.card(product.image_url || product.image || '/icon-512.png');
                const safeTitle = product.title || 'Laclarc Product';
                const truncatedTitle = safeTitle.length > 22 ? safeTitle.substring(0, 22) + '...' : safeTitle;

                return (
                  <div
                    key={product.id}
                    data-product-id={String(product.id)}
                    className={`t-accordion-card ${activeTrendingId === String(product.id) ? 'is-touched' : ''}`}
                    onClick={() => router.push(`/products/${product.id}`)}
                    tabIndex={0}
                  >
                    <img src={img} alt={safeTitle} />
                    <div className="t-accordion-head">
                      {truncatedTitle}
                      <span className="acc-price">${safePrice.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🧭 F#60 — شريط الفلترة: زر «Filter and sort» + شيبس — نفس الوجهة تاع all-products.
            الـ select القديم + بيلز الميزانية تنحاو: الدروار كيغطيهم جميع (نفس المكون حرفياً) */}
        <div className="bg-white p-4 rounded-2xl border border-temu-gray-border-light shadow-xs mb-6 space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-temu-black tracking-tight">
                {searchQuery ? `Results for "${searchQuery}"` : (activeCategory === 'All' ? 'Popular Essentials' : activeCategory)}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Showing <strong className="text-temu-black">{gridProducts.length}</strong> of{' '}
                {(isBrowsing && feed.totalCount) ? feed.totalCount.toLocaleString() : filteredProducts.length} items
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                ref={openerRef}
                type="button"
                id="pf-drawer-open"
                onClick={openDrawer}
                aria-haspopup="dialog"
                aria-expanded={drawerOpen ? 'true' : 'false'}
                aria-controls="pf-drawer-panel"
                className="inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-bold whitespace-nowrap text-temu-black shadow-xs transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] active:translate-y-px motion-reduce:transition-none"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" />
                </svg>
                Filter and sort
                {activeCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5B7EA6] px-1.5 text-xs font-bold text-white tabular-nums">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
              <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
                {chips.map((c, i) => (
                  <li key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-white border border-fog-200 pr-1 pl-3 text-[13px] whitespace-nowrap text-temu-black shadow-xs">
                    {c.label}
                    <button
                      type="button"
                      ref={(el) => { chipRefs.current[i] = el; }}
                      onClick={() => { c.onRemove(); focusNext.current = i; }}
                      aria-label={`Remove filter: ${c.label}`}
                      className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-temu-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] motion-reduce:transition-none"
                    >
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => { clearAllFilters(); focusNext.current = 'opener'; }}
                className="cursor-pointer rounded-sm text-[13px] font-bold whitespace-nowrap text-gray-500 underline underline-offset-4 transition-colors duration-150 hover:text-temu-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] motion-reduce:transition-none"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* 6. شبكة المنتجات — GOOGLE-GRID v6.1 LIGHT: masonry كيشبه نتائج
            صور Google (الصورة المرجعية تاع المالك) بصح على خلفية الموقع
            الفاتحة — طلب المالك: «نحوس كلش فاتح، خليها فاتحة نفس لون
            الموقع نتاعي» — بلا لوح غامق: الكروت يجلسو نيشان على خلفية
            الهوم (نفس كيما categories/favorites/all-products) */}
        <div className="mb-4">
          {/* 🩹 v5.1 — خطأ أول الصفحة (قاتل) — retry داخلي بلا reload */}
          {!loading && feed.error && (
            <div className="bg-white p-8 rounded-2xl border border-temu-gray-border-light shadow-xs text-center mb-4 space-y-3">
              <p className="text-temu-black font-bold text-sm">⚠️ {feed.error}</p>
              <button
                type="button"
                onClick={feed.retry}
                className="bg-temu-orange hover:bg-temu-orange-bright text-white px-5 py-2.5 rounded-full font-bold text-xs transition active:scale-95 shadow-md"
              >
                Try Again
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : gridProducts.length > 0 ? (
            <div
              className="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.product-card-wrapper');
                  if (card) {
                    setTouchedProductId(card.getAttribute('data-product-id'));
                  } else {
                    setTouchedProductId(null);
                  }
                }
              }}
              onTouchEnd={() => setTouchedProductId(null)}
            >
              {gridProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} eager={i < 4} />
              ))}
            </div>
          ) : !feed.error ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-temu-gray-border-light shadow-sm space-y-3">
              <span className="text-3xl">🔍</span>
              <p className="text-temu-gray-text font-bold text-sm">No products found matching these filters.</p>
              <p className="text-xs text-gray-400">Try adjusting your price range or sorting criteria.</p>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  setActiveCategory('All');
                  router.push('/');
                }}
                className="bg-temu-orange hover:bg-temu-orange-bright text-white px-5 py-2.5 rounded-full font-bold text-xs transition active:scale-95 shadow-md"
              >
                Clear All Filters
              </button>
            </div>
          ) : null}

          {/* 🎯 Sentinel — Temu-style infinite feed (بدل زر Load More) */}
          <div ref={feed.sentinelRef} className="h-10" />
          {feed.loadingMore && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
          {isBrowsing && feed.done && !loading && products.length > 0 && (
            <p className="text-center text-xs text-gray-400 py-8">
              🏁 You&apos;ve reached the end — {gridProducts.length.toLocaleString()} products
            </p>
          )}
        </div>
      </div>

      {/* ═══ F#60 — دروار الفلترة والفرز في الهوم (موبايل = شيت · ديسكتوب = جانبي)
          — نفس المكون تاع all-products حرفياً ═══ */}
      <FilterSortDrawer
        open={drawerOpen}
        onClose={dismissDrawer}
        sections={sections}
        onReset={clearDraft}
        onApply={applyDrawer}
        matchCount={draftMatches}
        openerRef={openerRef}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-temu-offwhite">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}