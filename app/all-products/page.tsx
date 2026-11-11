'use client';

// ═══════════════════════════════════════════════════════════════════
// GOOGLE-GRID v6 (2026-11-07 — طلب المالك): masonry كيما نتائج صور Google
// (بلاطة مدورة + العنوان تحت + سطر "Laclarc · $price") — نفس دالة النسب
// تاع ProductCard بالحرف (نفس hash = نفس الشكل في الصفحتين).
// ═══════════════════════════════════════════════════════════════════
// all-products v2.0 — مهاجر للكاتب الوحيد (Tenet #31) — الباب الثالث والأخير
// ═══════════════════════════════════════════════════════════════════
// تقييم صادق: هذا كان أنظف النسخ الثلاثة — أول دفعة كانت كتمر عبر loadMore(1)
// نفسها = تقدم الصفحة صحيح (ماكانش عندو باغ تكرار page=1) + حرس واحد لكل
// المسارات. ولكن كان النسخة الثالثة من نفس المنطق.
//
// اللي عطاه الـ hook مجاناً:
//   🛡️ dedup بالـ id — OFFSET-shift (massSync كيدخل منتجات بين صفحتين) مات
//   🛡️ حرس Array.isArray موحد (كان spread بلا حارس)
//   🩹 error/moreError منفصلين — فشل أول صفحة ≠ فشل صفحة زيادة
//      · moreError: الـ grid كيبقى كامل + auto-recovery بالسكرول أو الزر
//   🩹 retry داخلي بلا تجميد الحالة
//   🆕 🆕 العدّاد totalCount ولّى معروض فعلاً — الباكلوج الموثق "سطران" تسدّ
//      (كان كيتجاب من السيرفر وعمرو ما كيتعرض — dead code)
//   ✨ spinner من أول paint (كان loading=false = أول جلب بلا مؤشر)
//
// اللي تحافظ عليه: retry UX (Tenet #14) · prefetch 600px · end states · كل الـ JSX
//
// 🩹 v2.1 — Task 11 (تطبيق قرار eager + توحيد قواعد الثقة مع ProductCard):
//   FIX-EAGER — loading كان lazy على الكل حتى أول 4 كروت. هذه الصفحة بلا hero:
//               أول كارت هنا هو مرشح LCP رقم واحد → loading={i < 4 ? 'eager' : 'lazy'}
//               (i مطلق في المصفوفة المتراكمة — دفعات السكرول المضافة تلقائياً lazy)
//   FIX-TRUST — strikethrough كان بلا سقف: original_price مزيف من CJ (anchor pricing)
//               كان يعرض خصومات 9x% — الآن نفس قاعدة ProductCard بالحرف: يظهر فقط 1–89%
//   FIX-ZERO  — $0.00 على سعر مفقود كان قاتل ثقة — الصف يختفي (نفس ProductCard)
//   ملاحظة موثقة: مع unoptimized:true لا يوجد srcset → sizes معطلة اليوم، وتخدم يوم الـ flip
// ═══════════════════════════════════════════════════════════════════

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IMG } from '@/lib/imageOptimizer';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';
import FilterSortDrawer, { type DrawerSection } from '@/components/FilterSortDrawer';
import {
  COLOR_FACETS,
  DEFAULT_FILTERS,
  PRICE_BANDS,
  SORTS,
  activeFilterCount,
  countPrice,
  filterQuery,
  findBand,
  visibleProducts,
  type FilterState,
} from '@/lib/filterSort';
import GlassIcon from '@/components/ui/GlassIcon';

// نفس دالة ProductCard (GOOGLE-GRID) — نسب مدروس: القص مع object-cover
// يبقى في الهوامش البيض تاع صور CJ (المنتج في الوسط = ما يتقصش)
const MASONRY_RATIOS = ['4 / 5', '1 / 1', '3 / 4', '5 / 6', '1 / 1', '3 / 4', '4 / 5', '2 / 3'];
const masonryRatio = (id: string | number): string => {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return MASONRY_RATIOS[Math.abs(h) % MASONRY_RATIOS.length];
};

interface P {
  id: number;
  title: string;
  price: number;
  original_price?: number | null;
  image_url: string;
  category: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
const PER_PAGE = 24;

// ═══ F#57 — فاسيت الفئة (all-products برك): جذور الشجرة من /api/categories/hub
// counts سيرفر حقيقية · كاش جلسة · fail-open دائماً (فشل = فاسيت خاوي، الصفحة تخدم)
interface CatRoot { slugPath: string; name: string; count: number | null }
const CAT_FACET_CACHE = 'laclarc_catfacet_v1';
function readCatFacetCache(): CatRoot[] | null {
  try {
    const raw = sessionStorage.getItem(CAT_FACET_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.roots) ? parsed.roots : null;
  } catch { return null; }
}
function writeCatFacetCache(roots: CatRoot[]) {
  try { sessionStorage.setItem(CAT_FACET_CACHE, JSON.stringify({ roots })); } catch {}
}
async function fetchCategoryRoots(api: string): Promise<CatRoot[]> {
  const cached = readCatFacetCache();
  if (cached && cached.length > 0) return cached;
  try {
    const res = await fetch(`${api}/api/categories/hub`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const roots: CatRoot[] = (Array.isArray(data?.nodes) ? data.nodes : [])
      .filter((n: any) => n && typeof n.slugPath === 'string' && n.slugPath)
      .map((n: any) => ({
        slugPath: n.slugPath as string,
        name: String(n.name || n.slug || n.slugPath),
        count: typeof n.count === 'number' && n.count >= 0 ? n.count : null,
      }));
    if (roots.length === 0) throw new Error('empty hub');
    writeCatFacetCache(roots);
    return roots;
  } catch {
    return []; // fail-open — الفاسيت يبقى مخبي، السيرفر هو ما عندوش الجذور اليوم
  }
}

export default function AllProducts() {
  // ═══ F#57 — حالة الفلترة: applied (المطبقة) + draft (المسودة داخل الدروار) ═══
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const activeCategory = applied.category[0] ?? '';

  // ═══ الكاتب الوحيد — التوصيل فقط ═══
  // F#57-Phase2: resetKey كيتضمن كل الفلاتر — أي تبديل = إعادة تهيئة كاملة
  // (count + صفحة 1) والسيرفر هو اللي كيفلتر ويفرز على الكاتالوگ كامل
  const feed = useInfiniteFeed<P>(
    `all-products:${activeCategory}|${applied.price}|${applied.sort}|${applied.colour}`,
    true,
    {
      buildPageUrl: (page) =>
        activeCategory
          ? `${API}/api/products?category=${encodeURIComponent(activeCategory)}&page=${page}${filterQuery(applied)}`
          : `${API}/api/products?page=${page}${filterQuery(applied)}`,
      buildCountUrl: () =>
        activeCategory
          ? `${API}/api/products?count=1&category=${encodeURIComponent(activeCategory)}${filterQuery(applied)}`
          : `${API}/api/products?count=1${filterQuery(applied)}`,
      perPage: PER_PAGE,
    }
  );

  const {
    products: items,   // alias — الـ JSX كيبقى كما هو
    loading,
    error,
    moreError,
    done,
    totalCount,
    sentinelRef,
    loadMore,
    retry,
  } = feed;

  // ═══ F#57 — طبقة العرض فوق الكاتب (الكاتب ما يتنمسش — Tenet #31) ═══
  const visible = useMemo(() => visibleProducts(items, applied), [items, applied]);
  const filtersActive = activeFilterCount(applied) > 0;

  // فاسيت الجذور — كيتجاب أول مرة كيتفتح الدروار (كاش جلسة داخل المُجيب)
  const [catRoots, setCatRoots] = useState<CatRoot[] | null>(null);
  useEffect(() => {
    if (!drawerOpen || catRoots) return;
    let alive = true;
    fetchCategoryRoots(API).then((roots) => {
      if (alive && roots.length > 0) setCatRoots(roots);
    });
    return () => { alive = false; };
  }, [drawerOpen, catRoots]);

  // ═══ معالجات الدروار — draft/applied كيما في الديمو ═══
  const openDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(true); }, [applied]);
  const dismissDrawer = useCallback(() => { setDraft(applied); setDrawerOpen(false); }, [applied]);
  const applyDrawer = useCallback(() => { setApplied(draft); setDrawerOpen(false); }, [draft]);
  const toggleDraftSort = useCallback((v: string) => setDraft((d) => ({ ...d, sort: v as FilterState['sort'] })), []);
  const toggleDraftPrice = useCallback((v: string) => setDraft((d) => ({ ...d, price: v })), []);
  const toggleDraftColour = useCallback((v: string) => setDraft((d) => ({ ...d, colour: v })), []);
  const toggleDraftCategory = useCallback(
    (slugPath: string) => setDraft((d) => ({ ...d, category: d.category[0] === slugPath ? [] : [slugPath] })),
    []
  );
  const clearDraft = useCallback(() => setDraft((d) => ({ ...d, price: 'any', category: [], colour: '' })), []);
  const clearAllFilters = useCallback(() => {
    setApplied((prev) => {
      const next = { ...prev, price: 'any', category: [], colour: '' };
      setDraft(next);
      return next;
    });
  }, []);

  // ═══ الأقسام اللي كتمشي للدروار ═══
  const sections = useMemo<DrawerSection[]>(() => {
    const list: DrawerSection[] = [
      {
        key: 'sort',
        title: 'Sort by',
        type: 'radio',
        options: SORTS.map((s) => ({ value: s.value, label: s.label })),
        selected: [draft.sort],
        onToggle: toggleDraftSort,
      },
      {
        key: 'price',
        title: 'Price',
        type: 'radio',
        options: PRICE_BANDS.filter((b) => b.value !== 'any').map((b) => {
          const c = countPrice(items, b.value);
          return { value: b.value, label: b.label, count: c, disabled: c === 0 && draft.price !== b.value };
        }),
        selected: [draft.price],
        onToggle: toggleDraftPrice,
      },
      {
        // 🆕 F#57-Phase2 — فاسيت اللون (سيرفر-سايد EXISTS على variants)
        key: 'colour',
        title: 'Colour',
        type: 'radio',
        defaultFolded: true,
        options: [
          { value: '', label: 'Any colour' },
          ...COLOR_FACETS.map((c) => ({ value: c, label: c })),
        ],
        selected: [draft.colour],
        onToggle: toggleDraftColour,
      },
    ];
    if (catRoots && catRoots.length > 0) {
      list.push({
        key: 'category',
        title: 'Category',
        type: 'radio',
        defaultFolded: true,
        options: [
          { value: '', label: 'All categories' },
          ...catRoots.map((r) => ({
            value: r.slugPath,
            label: r.name,
            count: r.count,
            disabled: r.count === 0 && draft.category[0] !== r.slugPath,
          })),
        ],
        selected: draft.category,
        onToggle: toggleDraftCategory,
      });
    }
    return list;
  }, [draft, items, catRoots, toggleDraftSort, toggleDraftPrice, toggleDraftColour, toggleDraftCategory]);

  // رقم زر التطبيق — الصدق Phase2: كيتبدل الفئة/السعر/اللون = refetch سيرفر —
  // العدادات فوق المحمل ما عادش كيمثلو النتيجة الجاية → «Show results» بلا رقم
  const categoryChanged = (draft.category[0] ?? '') !== activeCategory;
  const priceChanged = draft.price !== applied.price;
  const colourChanged = draft.colour !== applied.colour;
  const matchCount = (categoryChanged || priceChanged || colourChanged)
    ? null
    : countPrice(items, draft.price);

  // ═══ الشيبس — كل فيلتر مطبق = شيب كيحيد راسو بضغطة ═══
  const chips = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (activeCategory) {
      const root = catRoots?.find((r) => r.slugPath === activeCategory);
      list.push({
        key: 'category',
        label: root?.name ?? activeCategory.replace(/-/g, ' '),
        onRemove: () => setApplied((prev) => ({ ...prev, category: [] })),
      });
    }
    if (applied.price !== 'any') {
      list.push({
        key: 'price',
        label: findBand(applied.price).label,
        onRemove: () => setApplied((prev) => ({ ...prev, price: 'any' })),
      });
    }
    if (applied.colour) {
      list.push({
        key: 'colour',
        label: applied.colour,
        onRemove: () => setApplied((prev) => ({ ...prev, colour: '' })),
      });
    }
    return list;
  }, [activeCategory, applied.price, applied.colour, catRoots]);

  return (
    <main className="min-h-screen bg-temu-offwhite">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-temu-black tracking-tight"><GlassIcon ch="🛍️" size="xs" /> All Products</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {filtersActive ? (
                <>
                  {visible.length} match{visible.length === 1 ? '' : 'es'}
                  {activeCategory
                    ? totalCount > 0 ? ` · ${totalCount.toLocaleString()} in this category` : ''
                    : ` · ${items.length} loaded`}
                </>
              ) : (
                <>
                  Browse the full catalog — {items.length}
                  {done
                    ? ' products'
                    : (totalCount > 0 ? ` of ${totalCount.toLocaleString()}` : '+')}
                </>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-[#5B7EA6] hover:underline"
          >
            <GlassIcon i="arrowLeft" size="xs" /> Home
          </Link>
        </div>

        {/* ═══ F#57 — شريط الفلترة: زر الدروار + شيبس الفلاتر المطبقة ═══ */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
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

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <ul aria-label="Applied filters" className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <li key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-white border border-fog-200 pr-1 pl-3 text-[13px] whitespace-nowrap text-temu-black shadow-xs">
                    {c.label}
                    <button
                      type="button"
                      onClick={c.onRemove}
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
                onClick={clearAllFilters}
                className="cursor-pointer rounded-sm text-[13px] font-bold whitespace-nowrap text-gray-500 underline underline-offset-4 transition-colors duration-150 hover:text-temu-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] motion-reduce:transition-none"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4">
          {visible.map((p, i) => {
            // 🩹 FIX-TRUST + FIX-ZERO — نفس قواعد ProductCard بالحرف (قاعدة واحدة في الموقع كله)
            const price = Number(p.price) || 0;
            const orig = Number(p.original_price) || 0;
            const disc = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
            const showOrig = disc > 0 && disc < 90;
            return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group block break-inside-avoid mb-3 sm:mb-4 cursor-pointer transition active:scale-[0.98]"
            >
              {/* GOOGLE-GRID v6 — بلاطة مدورة بطول متغير (نفس نسب ProductCard) */}
              <div
                className="relative rounded-xl overflow-hidden bg-white ring-1 ring-black/[0.04]"
                style={{ aspectRatio: masonryRatio(p.id) }}
              >
                <Image
                  src={IMG.card(p.image_url)}
                  alt={p.title}
                  fill
                  // مع unoptimized:true لا srcset — sizes معطلة اليوم وتخدم يوم الـ flip
                  sizes="(max-width:640px) 50vw, 20vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  loading={i < 4 ? 'eager' : 'lazy'}
                />
              </div>
              {/* المعلومات تحت البلاطة كيما نتائج صور Google — قواعد الثقة كما هي */}
              <div className="px-0.5 pt-2 min-w-0">
                <p className="text-[13px] font-medium text-temu-black line-clamp-2 leading-[1.45]">
                  {p.title}
                </p>
                {/* FIX-ZERO + FIX-TRUST — بلا سعر = بلا صف · بلا سقف 90% = بلا anchor مزيف */}
                {price > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] leading-none text-gray-500 min-w-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <span className="font-semibold shrink-0">Laclarc</span>
                    <span aria-hidden="true" className="opacity-55">&middot;</span>
                    <span className="font-semibold">${price.toFixed(2)}</span>
                    {showOrig && (
                      <span className="text-[10.5px] line-through opacity-70">
                        ${orig.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
            );
          })}
        </div>

        {/* Sentinel + states */}
        <div ref={sentinelRef} className="h-10" />

        {/* 🩹 F#57 — الفلاتر مطبقة وولا خاوية: الصفحة كتشرح الصدق — الـ feed كمّل يخدم */}
        {!loading && !error && visible.length === 0 && items.length > 0 && (
          <div className="bg-white p-10 rounded-xl border border-gray-100 text-center space-y-3">
            <p className="text-sm font-bold text-temu-black">No matches with the current filters.</p>
            <p className="text-xs text-gray-500">More products keep loading as you scroll — or clear the filters.</p>
            <button
              onClick={clearAllFilters}
              className="text-xs font-bold bg-[#5B7EA6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-[#5B7EA6] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* 🩹 v2.0 — فشل أول صفحة (قاتل) — retry داخلي */}
        {error && !loading && (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs font-bold text-temu-black"><GlassIcon ch="⚠️" size="xs" /> {error}</p>
            <button
              onClick={retry}
              className="text-xs font-bold bg-[#5B7EA6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              <GlassIcon i="refresh" size="xs" /> Retry
            </button>
          </div>
        )}

        {/* 🩹 v2.0 — فشل صفحة زيادة (غير قاتل): الـ grid كامل قدامك —
            الـ retry بالزر أو غير كمّل سكرول (الـ observer حي وكيأكد أوتوماتيك) */}
        {moreError && !loading && !error && (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs font-bold text-temu-black"><GlassIcon ch="⚠️" size="xs" /> {moreError}</p>
            <button
              onClick={loadMore}
              className="text-xs font-bold bg-[#5B7EA6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              <GlassIcon i="refresh" size="xs" /> Retry
            </button>
          </div>
        )}

        {done && items.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-8">
            <GlassIcon ch="🏁" size="xs" /> You&apos;ve reached the end — {items.length} products
          </p>
        )}
        {done && items.length === 0 && !error && (
          <p className="text-center text-sm text-gray-500 py-16">
            No products available right now.
          </p>
        )}
      </div>

      {/* ═══ F#57 — دروار الفلترة والفرز (موبايل = شيت من التحت · ديسكتوب = جانبي) ═══ */}
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