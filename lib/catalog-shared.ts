// lib/catalog-shared.ts — phase-2 D1 (2026-11-28) — أدوات مشتركة بين db-reads (Postgres) و d1-catalog (D1)
// ═══════════════════════════════════════════════════════════════════════
// مصدر واحد لكل الثوابت/التحويلات اللي كانوا منسوخين من server.js —
// db-reads.ts كيستوردها من هنا، و d1-catalog.ts نفس الشي. بلا أي import
// خارجي — ملف standalone باش ما يكونش cycle بين الطبقتين.
// ═══════════════════════════════════════════════════════════════════════

// SW_SIZE_ONLY_RX / SW_MAX — server.js:2616/2620
export const SW_SIZE_ONLY_RX = /^(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|\d{1,4})$/i;
export const SW_MAX = 5;

// SIZE_RX_SQL — server.js:2617 (مرجع — الحرس الفعلي كيتم فparseNamesParam)
export const SIZE_RX_SQL = '^(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|\\d{1,4})$';

// escapeLikeSafe — server.js:6
export function escapeLikeSafe(s: string): string {
  return String(s).replace(/[\\%_]/g, '\\$&');
}

// CATALOG_SORTS — server.js:2900 (whitelist — بلا حقن)
export const CATALOG_SORTS: Record<string, string> = {
  'price-asc': 'price ASC, id DESC',
  'price-desc': 'price DESC, id ASC',
  newest: 'created_at DESC, id DESC',
};

// parsePriceParam — server.js:2905
export function parsePriceParam(v: string | null): number | null {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : null;
}

// parseNamesParam — server.js:2917 (F#59 — نفس المنقّي حرفياً)
export function parseNamesParam(v: string | null, isSize: boolean): string[] {
  const raw = String(v ?? '');
  if (!raw.trim()) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const c = part.trim().slice(0, 40);
    if (!c) continue;
    if (isSize ? !SW_SIZE_ONLY_RX.test(c) : SW_SIZE_ONLY_RX.test(c)) continue;
    if (seen.size >= 8) break;
    seen.add(c);
  }
  return [...seen];
}

// withSwatches — server.js:2634 (نفس التحويل حرفياً — كيستقبل swatches
// كparsed array ولا JSON string، كيخرج نفس الشكل: {swatches, swMore?})
export function withSwatches(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  try {
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      if (!('swatches' in r)) continue;
      let arr = r.swatches;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr || '[]'); } catch { arr = []; }
      }
      if (!Array.isArray(arr)) { r.swatches = []; continue; }
      const out: Record<string, unknown>[] = [];
      const seenImg = new Set<string>();
      let total = 0;
      for (const s of arr as Record<string, unknown>[]) {
        const c = (s && typeof s.c === 'string') ? s.c.trim() : '';
        const i = (s && typeof s.i === 'string') ? s.i.trim() : '';
        if (!c || !i) continue;
        if (SW_SIZE_ONLY_RX.test(c)) continue; // مقاس-فقط (XL/42) ماشي لون
        total++;
        if (seenImg.has(i)) continue;
        seenImg.add(i);
        if (out.length < SW_MAX) {
          out.push({ c: c.slice(0, 40), i, v: (s && typeof s.v === 'string' && s.v) ? s.v : undefined });
        }
      }
      r.swatches = out;
      const more = total - out.length;
      if (more > 0) r.swMore = more;
    }
  } catch (e) {
    console.warn('[catalog-shared] withSwatches failed:', e instanceof Error ? e.message : e);
  }
  return rows;
}

// PUBLIC_SETTING_KEYS / PUBLIC_LIST_KEYS — server.js:3845-3846
export const PUBLIC_SETTING_KEYS = ['show_reels', 'show_lightning', 'show_fb', 'hidden_routes', 'hidden_sections'];
export const PUBLIC_LIST_KEYS = ['hidden_routes', 'hidden_sections'];

// PDP columns — server.js:1302/1303 (D1: السكيما ثابتة — كامل كاينين)
export const PDP_COLS_GUARANTEED = [
  'id', 'title', 'description', 'price', 'original_price', 'image_url',
  'images', 'variants', 'colors', 'sizes', 'category', 'video_url',
  'material', 'stock_status', 'cj_product_id', 'is_sourced', 'created_at',
  'seo_title', 'seo_meta_description',
];
export const PDP_COLS_OPTIONAL = ['patterns', 'colour_names', 'size_names', 'pattern', 'origin', 'composition'];

export const MINIMAL_CHUNK = 20000; // server.js — minimal chunked
export const CATALOG_PER = 24;      // server.js:3021

// ─── نرمالايزرز D1 ← contract الباك (node-pg) ───

/** JSON array string → array (fail → fallback) */
export function parseJsonArrayCol(v: unknown): unknown[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p;
    } catch { /* fallthrough */ }
  }
  return [];
}

/** ';a;b;' (سيريالايزيشن text[] تاع local PG) → array — كيتعامل حتى مع JSON */
export function parseSemiArrayCol(v: unknown): unknown[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === '[]') return [];
    if (s.startsWith('[')) {
      try {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      } catch { /* fallthrough */ }
    }
    return s.split(';').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

/** عمود JSON string → قيمة parsed (fail → السلسلة الخام نفسها — سلوك الباك) */
export function parseJsonColKeepRaw(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

/**
 * facets + swatch_raw من variants — نفس دلالات SW_SQL + buildCatalogFilters
 * حرفياً (مرآة backfill_facets.py — مصدر واحد للدلالة):
 *   colour = قبل آخر '-' (ولا الكامل إلا ما كاينش dash) · size = من بعد آخر '-'
 *   swatch candidates = أول صورة لكل لون (بالترتيب) — withSwatches كيصفي من بعد.
 * كيرجع {facetColors: '|c1|c2|', facetSizes: '|s1|', swatchRaw: JSON string}
 */
export function buildFacetsFromVariants(variantsRaw: unknown): {
  facetColors: string; facetSizes: string; swatchRaw: string;
} {
  let arr: unknown[] = [];
  try {
    const p = typeof variantsRaw === 'string' ? JSON.parse(variantsRaw || '[]') : variantsRaw;
    if (Array.isArray(p)) arr = p;
  } catch { arr = []; }

  const colours: string[] = [];
  const sizes: string[] = [];
  const seenC = new Set<string>();
  const seenS = new Set<string>();
  const swatch: { c: string; i: string; v?: string }[] = [];
  const seenSw = new Set<string>();

  for (const v of arr) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const vk = o.variantKey;
    if (!vk || typeof vk !== 'string') continue;
    const dash = vk.lastIndexOf('-');
    const colour = (dash === -1 ? vk : vk.slice(0, dash)).replace(/\|/g, '');
    const size = (dash === -1 ? '' : vk.slice(dash + 1)).replace(/\|/g, '');
    if (colour && !seenC.has(colour.toLowerCase())) { seenC.add(colour.toLowerCase()); colours.push(colour); }
    if (size && !seenS.has(size.toLowerCase())) { seenS.add(size.toLowerCase()); sizes.push(size); }
    const img = o.variantImage;
    if (img && typeof img === 'string' && colour && !seenSw.has(colour)) {
      seenSw.add(colour);
      swatch.push({ c: colour, i: img, v: typeof o.vid === 'string' ? o.vid : undefined });
    }
  }

  return {
    facetColors: colours.length ? '|' + colours.join('|') + '|' : '',
    facetSizes: sizes.length ? '|' + sizes.join('|') + '|' : '',
    swatchRaw: JSON.stringify(swatch),
  };
}
