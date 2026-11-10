// ═══════════════════════════════════════════════════════════════════════
// lib/filterSort.ts — F#57-filterdrawer — المنطق النقي المشترك للفلترة والفرز
// ═══════════════════════════════════════════════════════════════════════
// مستعمل من /all-products و /category/* — صفر React، صفر fetch: دوال نقية
// كتقبل المصفوفات والحقول كيما جاو من الـ feed.
//
// تقسيم الحقيقة (قانون المرحلة 1 — موثق في الجولة):
//   · category  = سيرفر-سايد (resetKey جديد → الكاتب الوحيد يجيب من جديد)
//   · price     = كلاينت-سايد فوق المنتجات المحملة (الباك ما يفهمش price params)
//   · sort      = كلاينت-سايد فوق المنتجات المحملة (نفس دلالة الفرز الحالية)
// العدادات اللي كتشوفها في الدروار = فوق المحمل برك — الصدق قبل الزخرفة.
// ═══════════════════════════════════════════════════════════════════════

export type SortKey = 'recommended' | 'price-asc' | 'price-desc';

export interface FilterState {
  sort: SortKey;
  /** band value من PRICE_BANDS — 'any' = بلا فيلتر */
  price: string;
  /** slugPath تاع فئة الجذر — [] = كل الفئات (سيرفر-سايد عبر resetKey) */
  category: string[];
}

export const DEFAULT_FILTERS: FilterState = { sort: 'recommended', price: 'any', category: [] };

export interface SortOption {
  value: SortKey;
  label: string;
}

// ما كاينش "Newest" ولا "Rating" — ما عندناش حقل تاريخ/تقييم موثوق في الباك،
// والعد الصادق أهلى من وعد مزيف (درس F#31).
export const SORTS: SortOption[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
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

/** الفلترة (السعر) + الفرز — القائمة المعروضة. الصف الأصلي ما يتبدلش */
export function visibleProducts<T extends { price?: unknown }>(products: T[], state: FilterState): T[] {
  const filtered = state.price === 'any' ? products : products.filter((p) => passesPrice(p, state.price));
  if (state.sort === 'recommended') return filtered;
  const dir = state.sort === 'price-asc' ? 1 : -1;
  return [...filtered].sort((a, b) => (priceOf(a) - priceOf(b)) * dir);
}

/** شحال من فيلتر نشيط (للشيبس والبايدج) — الفرز ما كيتعداش فيلتر */
export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.price !== 'any') n += 1;
  n += state.category.length;
  return n;
}
