'use client';

// ═══════════════════════════════════════════════════════════════════
// CategoryClient v2.0 — مهاجر للكاتب الوحيد (Tenet #31)
// ═══════════════════════════════════════════════════════════════════
// كل منطق الـ feed (أول صفحة · observer · Load More · dedup · mutex · gen
// · عدّاد · retry) عايش في lib/useInfiniteFeed.ts — هنا غير التوصيل والعرض.
//
// الباغات اللي عالجها الـ hook بلا مكان لهذا الملف:
//   🩹 تكرار page=1 عند أول scroll/click (نفس باغ الهوم — setPage(2))
//   🩹 FIX-DEAD: الـ observer ميت على cold load (loading خارج الـ deps)
//      — التشخيص الحقيقي ديال "حساس على بعض المتصفحات" تاع M#58
//   🛡️ سباق الزر/observer (حراس منفصلين → mutex واحد)
//   🛡️ تلوث cross-category (genRef في كل المسارات)
//   🩹 الخطأ اليتيم (نجاح loadMore كيمسح error) + الخطأ غير القاتل ولّى
//      inline (moreError) — ماكيمسحش الـ grid
//   🩹 retry داخلي — window.location.reload مات (لا مسح للجلسة والسكرول)
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../../components/ProductCard';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';
import FilterSortDrawer from '@/components/FilterSortDrawer';
import {
  COLOR_FACETS,
  COLOR_SWATCHES,
  DEFAULT_FILTERS,
  PRICE_BANDS,
  SIZE_FACETS,
  SORTS,
  activeFilterCount,
  countPrice,
  filterQuery,
  findBand,
  findSort,
  visibleProducts,
  type FilterState,
} from '@/lib/filterSort';
import GlassIcon from '@/components/ui/GlassIcon';
import { useSiteConfig, UnavailablePanel } from '../../components/SiteConfigProvider';
import { isCategoryHidden } from '@/lib/siteConfig';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  image: string;
  image_url?: string;
  category?: string;
  [key: string]: any;
}

const PER_PAGE = 24;

// ✨ Task 21-e: h1Text كيجي من القاعدة (seo_h1) عبر الـ Server Wrapper — fallback: categoryName
export default function CategoryClient({ h1Text }: { h1Text?: string | null }) {
  const params = useParams();
  const router = useRouter();

  // 👁️ F#93 — كونفيگ الظهور (fail-open)
  const { cfg: siteCfg, ready: siteCfgReady } = useSiteConfig();

  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/');
  const slug = slugArray[slugArray.length - 1];

  const categoryName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ✨ Tenet #4 — بلا hardcoded URLs
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ═══ F#57-Phase2 — حالة الفلترة فوق الكاتب (resetKey تاع الـ hook كيقراها) ═══
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // 🆕 v2 — إدارة التركيز تاع الشيبس (نمط الديمو) — نفسها فall-products
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

  // ═══ الكاتب الوحيد — التوصيل فقط ═══
  // resetKey كيتضمن كل الفلاتر — أي تبديل = إعادة تهيئة كاملة والسيرفر كيفلتر
  const feed = useInfiniteFeed<Product>(
    `${slugPath}|${applied.price}|${applied.sort}|${applied.colour.join(',')}|${applied.size.join(',')}`,
    true,
    {
      buildPageUrl: (page) =>
        `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&page=${page}${filterQuery(applied)}`,
      buildCountUrl: () =>
        `${API_BASE_URL}/api/products?category=${encodeURIComponent(slugPath)}&count=1${filterQuery(applied)}`,
      perPage: PER_PAGE,
    }
  );

  const {
    products,
    loading,
    loadingMore,
    error,
    moreError,
    done,
    totalCount,
    sentinelRef,
    loadMore,
    retry,
  } = feed;

  const [touchedProductId, setTouchedProductId] = useState<string | null>(null);

  // ═══ F#57 — معالجات الفلترة (الحالة معرفة فوق الـ hook) ═══
  // هنا بلا فاسيت فئة — الفئة مثبتة من الـ slug (السيرفر هو اللي كيفترد) ═══
  const visible = useMemo(() => visibleProducts(products, applied), [products, applied]);
  const filtersActive = activeFilterCount(applied) > 0;

  const openDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(true); }, [applied]);
  const dismissDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(false); }, [applied]);
  const applyDrawer = useCallback(() => { setApplied(draft); setDrawerOpen(false); }, [draft]);
  const toggleDraftSort = useCallback((v: string) => setDraft((d) => ({ ...d, sort: v as FilterState['sort'] })), []);
  const toggleDraftPrice = useCallback((v: string) => setDraft((d) => ({ ...d, price: v })), []);
  // 🆕 v2 — اللون والمقاس متعددين (كيما الديمو) — الضغطة كتزيد/كيحيد من القائمة
  const toggleDraftColour = useCallback(
    (v: string) => setDraft((d) => ({ ...d, colour: d.colour.includes(v) ? d.colour.filter((x) => x !== v) : [...d.colour, v] })),
    []
  );
  const toggleDraftSize = useCallback(
    (v: string) => setDraft((d) => ({ ...d, size: d.size.includes(v) ? d.size.filter((x) => x !== v) : [...d.size, v] })),
    []
  );
  const clearDraft = useCallback(() => setDraft((d) => ({ ...d, price: 'any', colour: [], size: [] })), []);
  const clearAllFilters = useCallback(() => {
    setApplied((prev) => {
      const next = { ...prev, price: 'any', colour: [], size: [] };
      setDraft(next);
      return next;
    });
  }, []);

  const sections = useMemo(
    () => [
      {
        key: 'sort',
        title: 'Sort by',
        type: 'radio' as const,
        summary: findSort(draft.sort).label,
        options: SORTS.map((s) => ({ value: s.value, label: s.label })),
        selected: [draft.sort],
        onToggle: toggleDraftSort,
      },
      {
        key: 'price',
        title: 'Price',
        type: 'radio' as const,
        summary: findBand(draft.price).label,
        options: PRICE_BANDS.filter((b) => b.value !== 'any').map((b) => {
          const c = countPrice(products, b.value);
          return { value: b.value, label: b.label, count: c, disabled: c === 0 && draft.price !== b.value };
        }),
        selected: [draft.price],
        onToggle: toggleDraftPrice,
      },
      {
        // 🆕 v2 — فاسيت اللون multi-select بدواير حقيقية (نمط الديمو)
        key: 'colour',
        title: 'Colour',
        type: 'swatch' as const,
        defaultFolded: true,
        summary: draft.colour.length ? draft.colour.join(', ') : 'Any',
        options: COLOR_FACETS.map((c) => ({ value: c, label: c, swatch: COLOR_SWATCHES[c] })),
        selected: draft.colour,
        onToggle: toggleDraftColour,
      },
      {
        // 🆕 v2 — فاسيت المقاس بالبلاطات (نمط الديمو) — سيرفر-سايد suffix تاع variantKey
        key: 'size',
        title: 'Size',
        type: 'tiles' as const,
        defaultFolded: true,
        summary: draft.size.length ? draft.size.join(', ') : 'Any',
        options: SIZE_FACETS.map((s) => ({ value: s, label: s })),
        selected: draft.size,
        onToggle: toggleDraftSize,
      },
    ],
    [draft, products, toggleDraftSort, toggleDraftPrice, toggleDraftColour, toggleDraftSize]
  );

  // رقم زر التطبيق — الصدق Phase2: كيتبدل السعر/اللون/المقاس = refetch سيرفر →
  // العدادات فوق المحمل ما عادش كيمثلو النتيجة الجاية → «Show results» بلا رقم
  const priceChanged = draft.price !== applied.price;
  const colourChanged = draft.colour.join(',') !== applied.colour.join(',');
  const sizeChanged = draft.size.join(',') !== applied.size.join(',');
  const matchCount = (priceChanged || colourChanged || sizeChanged) ? null : countPrice(products, draft.price);

  // 🆕 v2 — الشيبس: شيب لكل قيمة (اللون/المقاس متعددين)
  const chips = [
    ...(applied.price !== 'any'
      ? [{ key: 'price', label: findBand(applied.price).label, onRemove: () => setApplied((prev) => ({ ...prev, price: 'any' })) }]
      : []),
    ...applied.colour.map((c) => ({
      key: `colour-${c}`,
      label: c,
      onRemove: () => setApplied((prev) => ({ ...prev, colour: prev.colour.filter((x) => x !== c) })),
    })),
    ...applied.size.map((s) => ({
      key: `size-${s}`,
      label: `Size ${s}`,
      onRemove: () => setApplied((prev) => ({ ...prev, size: prev.size.filter((x) => x !== s) })),
    })),
  ];

  // 👁️ F#93 — القسم مخفي من الكونفيگ → لوحة "غير متاح مؤقتاً" (بعد كل الـ hooks)
  if (siteCfgReady && isCategoryHidden(slugPath, siteCfg?.hiddenCategories)) {
    return <UnavailablePanel refLabel={slugPath} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        {/* 🎯 SEO (Task 21-f): h1 حقيقي فالـ SSR HTML حتى فحالة التحميل —
            كيتبدل بالمرئي (نفس النص) من بعد ما الـ feed يجي — h1 واحد فأي لحظة */}
        {h1Text && <h1 className="sr-only">{h1Text}</h1>}
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/categories')}
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          All Categories
        </button>

        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h1 className="text-3xl font-extrabold text-temu-black capitalize">{h1Text || categoryName}</h1>
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <span className="text-xs font-bold text-gray-400">
                {/* F#58 honestheader — السيرفر هو الصادق: «X of Y matches» (count=1+filters) —
                    القديم كان كيقول «48 matches» وهو ماشي غير المحمل (السيرفر عندو 2,496) */}
                {filtersActive
                  ? `${visible.length} of ${totalCount.toLocaleString()} matches`
                  : `${totalCount.toLocaleString()} products`}
              </span>
            )}
            {/* F#57 — زر الدروار */}
            <button
              ref={openerRef}
              type="button"
              id="pf-drawer-open"
              onClick={openDrawer}
              aria-haspopup="dialog"
              aria-expanded={drawerOpen ? 'true' : 'false'}
              aria-controls="pf-drawer-panel"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-bold whitespace-nowrap text-temu-black shadow-xs transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] active:translate-y-px motion-reduce:transition-none"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" />
              </svg>
              Filter and sort
              {filtersActive && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5B7EA6] px-1.5 text-xs font-bold text-white tabular-nums">
                  {activeFilterCount(applied)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* F#57 — شيبس الفلاتر المطبقة */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <ul aria-label="Applied filters" className="flex flex-wrap gap-2">
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

        {/* حالة الخطأ القاتل منفصلة — retry داخلي (بلا reload — الجلسة والسكرول كيبقاو) */}
        {error && (
          <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <p className="text-temu-black font-semibold mb-2"><GlassIcon ch="⚠️" size="xs" /> {error}</p>
            <button
              onClick={retry}
              className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && products.length === 0 ? (
          <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-gray-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <p className="text-temu-black font-semibold mb-2">No products found in this category yet.</p>
            <p className="text-temu-gray-light text-sm mb-6">We are adding new items daily. Check back soon!</p>
            <Link
              href="/"
              className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div
              className="columns-2 md:columns-3 lg:columns-4 gap-4"
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) {
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const card = el?.closest('.product-card-wrapper');
                  if (card) {
                    const id = card.getAttribute('data-product-id');
                    setTouchedProductId(id);
                  } else {
                    setTouchedProductId(null);
                  }
                }
              }}
              onTouchEnd={() => setTouchedProductId(null)}
            >
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} eager={i < 4} />
              ))}
            </div>

            {/* F#57 — الفلاتر مطبقة ولا النتيجة خاوية فوق المحمل — صدق + مخرج */}
            {!loadingMore && visible.length === 0 && products.length > 0 && (
              <div className="bg-white p-10 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light space-y-3">
                <p className="text-temu-black font-semibold">No matches with the current filters.</p>
                <p className="text-temu-gray-light text-sm">More products keep loading as you scroll — or clear the filters.</p>
                <button
                  onClick={clearAllFilters}
                  className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Sentinel (infinite scroll) — الـ observer كيتصاوب فعلاً (FIX-DEAD مغروز في الـ hook) */}
            <div ref={sentinelRef} className="h-10" />

            {loadingMore && (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* 🩹 v2.0 — moreError غير قاتل: inline — الـ grid كيبقى كامل والزر هو الـ retry */}
            {moreError && products.length > 0 && !loadingMore && (
              <p className="text-center text-xs font-bold text-temu-black pb-2">
                <GlassIcon ch="⚠️" size="xs" /> {moreError} Press Load More to retry.
              </p>
            )}

            {/* Load More صريح — dual mode (observer تلقائي + زر مضمون 100%) */}
            {!done && !loadingMore && products.length > 0 && (
              <div className="flex justify-center py-6">
                <button
                  onClick={loadMore}
                  className="bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-3.5 px-10 rounded-temu-sm transition cursor-pointer active:scale-95 shadow-md text-sm gap-2 flex items-center touch-manipulation"
                >
                  Load More ({products.length} / {totalCount > 0 ? totalCount.toLocaleString() : '∞'})
                </button>
              </div>
            )}

            {/* End state */}
            {done && products.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-8">
                <GlassIcon ch="🏁" size="xs" /> {totalCount > 0
                  ? `${totalCount.toLocaleString()} products in this category`
                  : `${products.length} products`}
              </p>
            )}
          </>
        )}
      </div>

      {/* F#57 — دروار الفلترة والفرز */}
      <FilterSortDrawer
        open={drawerOpen}
        onClose={dismissDrawer}
        sections={sections}
        onReset={clearDraft}
        onApply={applyDrawer}
        matchCount={matchCount}
        openerRef={openerRef}
      />
    </main>
  );
}