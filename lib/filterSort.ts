// ═══════════════════════════════════════════════════════════════════════
// lib/filterSort.ts — F#57-filterdrawer — المنطق النقي المشترك للفلترة والفرز
// ═══════════════════════════════════════════════════════════════════════
// مستعمل من /all-products و /category/* — صفر React، صفر fetch: دوال نقية
// كتقبل المصفوفات والحقول كيما جاو من الـ feed.
//
// تقسيم الحقيقة (F#57-Phase2 — الباك فهم price/sort/colour params):
//   · category/price/colour/sort = سيرفر-سايد على الكاتالوگ كامل (53k+) —
//     filterQuery() كيبني الـ params وresetKey جديد = الكاتب الوحيد يجيب من جديد.
//   · visibleProducts/countPrice بقاو فوق المحمل كطبقة عرض/safety-net:
//     مكررة idempotent مع السيرفر (نفس النطاقات بالحرف) — إلا الباك ما وصلش
//     للـ patch الجديد، الفلترة كتخدم فوق المحمل بدل ما تهبط خاوية (graceful).
//     · colour ما عندوش safety-net كلاينت عمداً (swatches سقف 5 — العد والحقيقة
//       غير عند السيرفر EXISTS على variants كاملين) — بلا باك جديد = بلا فلترة لون.
// العدادات في الدروار = فوق المحمل برك · totalCount = سيرفر صادق (?count=1+filters).
// ═══════════════════════════════════════════════════════════════════════

export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'newest';

export interface FilterState {
  sort: SortKey;
  /** band value من PRICE_BANDS — 'any' = بلا فيلتر */
  price: string;
  /** slugPath تاع فئة الجذر — [] = كل الفئات (سيرفر-سايد عبر resetKey) */
  category: string[];
  /** لون واحد (سيرفر-سايد colour param على variants) — '' = أي لون */
  colour: string;
}

export const DEFAULT_FILTERS: FilterState = { sort: 'recommended', price: 'any', category: [], colour: '' };

export interface SortOption {
  value: SortKey;
  label: string;
}

// 🆕 Phase2: "Newest" ولّى ممكن — created_at موجود وممتلئ في الداتابيس (probed live)
// والسيرفر كيفرز بيه حرفياً (created_at DESC, id DESC). Rating مازال ماكاينش —
// ما عندناش تقييمات موثوقة، والعد الصادق أهلى من وعد مزيف (درس F#31).
export const SORTS: SortOption[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest arrivals' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

// 🆕 Phase2 — فاسيت اللون: أسماء CJ الشائعة في الـ variants (variantKey "Color-Size").
// قائمة مقفلة بأسماء CJ الشائعة — السيرفر ILIKE exact على الاستخراج نفس تاع SW_SQL؛
// لون ماكاينش في الكاتالوگ = 0 نتائج (empty state موجود — بلا عدّاد مزيف).
export const COLOR_FACETS: string[] = [
  'Black', 'White', 'Gray', 'Blue', 'Navy Blue', 'Red', 'Green', 'Yellow',
  'Pink', 'Purple', 'Orange', 'Beige', 'Brown', 'Silver', 'Gold', 'Multicolor',
];

export interface PriceBand {
  value: string;
  label: string;
  min: number;
  max: number; // Infinity = بلا سقف
}

export const PRICE_BANDS: PriceBand[] = [
  { value: 'any', label: 'Any price', min: 0, max: Infinity },
  { value: 'under-10', label: 'Under $10', min: 0, max: 10 },
  { value: '10-25', label: '$10 to $25', min: 10, max: 25 },
  { value: '25-50', label: '$25 to $50', min: 25, max: 50 },
  { value: 'over-50', label: 'Over $50', min: 50, max: Infinity },
];

export const findBand = (value: string): PriceBand =>
  PRICE_BANDS.find((b) => b.value === value) ?? PRICE_BANDS[0];

export const findSort = (value: string): SortOption =>
  SORTS.find((s) => s.value === value) ?? SORTS[0];

const priceOf = (p: { price?: unknown }): number => Number(p?.price) || 0;

/** واش المنتج داخل في نطاق السعر — $0.00 (سعر مفقود) كيدخل غير في 'any' */
export function passesPrice(p: { price?: unknown }, bandValue: string): boolean {
  const band = findBand(bandValue);
  if (band.value === 'any') return true;
  const price = priceOf(p);
  if (price <= 0) return false; // FIX-ZERO — بلا سعر = بلا وعد زائف في الفلترة
  return price >= band.min && price < (band.value === 'over-50' ? Infinity : band.max + 0.001);
}

/** العدادات ديال الفاسيت تاع السعر — فوق المحمل، مع منطق skip تاع الديمو:
 *  "شحال غادي يبقى إلا اخترت هاد النطاق" — مستقلة على الاختيار الحالي */
export function countPrice(products: { price?: unknown }[], bandValue: string): number {
  return products.reduce((acc, p) => (passesPrice(p, bandValue) ? acc + 1 : acc), 0);
}

/** الفلترة (السعر) + الفرز — طبقة العرض فوق الكاتب (safety-net idempotent):
 *  السيرفر كيفلتر/كيفرز نفس النطاقات — إلا وصل، هاد الطبقة ما كتبدل والو؛
 *  إلا ما وصلش (باك قديم)، الفلترة كتخدم فوق المحمل بدل ما تهبط خاوية.
 *  colour ما كيتفلترش هنا عمداً — swatches سقف 5، الحقيقة غير عند السيرفر. */
export function visibleProducts<T extends { price?: unknown }>(products: T[], state: FilterState): T[] {
  const filtered = state.price === 'any' ? products : products.filter((p) => passesPrice(p, state.price));
  if (state.sort === 'recommended' || state.sort === 'newest') return filtered; // newest = السيرفر كيفرز بيه (created_at)
  const dir = state.sort === 'price-asc' ? 1 : -1;
  return [...filtered].sort((a, b) => (priceOf(a) - priceOf(b)) * dir);
}

/** شحال من فيلتر نشيط (للشيبس والبايدج) — الفرز ما كيتعداش فيلتر */
export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.price !== 'any') n += 1;
  if (state.colour) n += 1;
  n += state.category.length;
  return n;
}

/** 🆕 Phase2 — الـ params تاع الفلترة للسيرفر (كيتزادو بعد ?... ولا ?count=1):
 *  minPrice/maxPrice من النطاق · colour · sort — كل واحد غير إلا نشيط.
 *  الدلالة متطابقة مع passesPrice بالحرف (سقف النطاق inclusive في الجوج جهات):
 *    under-10 → maxPrice=10 · 10-25 → minPrice=10&maxPrice=25 · over-50 → minPrice=50
 *  رجّع '' إلا ماكاين حتى فيلتر — الـ URL كيبقى كيف ما كان (byte-compat مع Phase 1). */
export function filterQuery(state: Pick<FilterState, 'sort' | 'price' | 'colour'>): string {
  const sp = new URLSearchParams();
  const band = findBand(state.price);
  if (band.value !== 'any') {
    if (band.min > 0) sp.set('minPrice', String(band.min));
    if (Number.isFinite(band.max)) sp.set('maxPrice', String(band.max));
  }
  if (state.colour) sp.set('colour', state.colour);
  if (state.sort !== 'recommended') sp.set('sort', state.sort);
  const q = sp.toString();
  return q ? `&${q}` : '';
}
