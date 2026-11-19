// lib/db-reads.ts — F106 HYPERDRIVE-RO — قراءات الكاتالوغ بنفس أشكال الـ API الباك
// ═══════════════════════════════════════════════════════════════════════
// كل دالة هنا مرآة حرفية لـ handler معين في server.js (الباك على Render):
//   dbProduct          ← GET /api/products/:id          (fetchProductProjected + parse images)
//   dbRelated          ← GET /api/products/:id/related   (3 مراحل: exact → base → random)
//   dbProductsLimit    ← GET /api/products?limit=N       (سقف 50 + swatches)
//   dbSettings         ← GET /api/settings               (store_settings)
//   dbCategorySeo      ← GET /api/categories/seo         (أعمدة seo_* متكيفة)
//   dbProductsMinimal  ← GET /api/products?minimal=1     ({id, created_at} chunks)
//
// 🔁 العقد (tri-state) — حتى إلا طاح Hyperdrive ما كتتكسر حتى صفحة:
//   undefined = طبقة DB غير متوفرة → المنادي كيرجع لمسار الـ API الباك (سلوك اليوم)
//   null      = DB جاوبت: غير موجود (404 صادقة)
//   value     = DB جاوبت: نفس شكل JSON ديال الـ API
//
// 🩹 أي فشل DB (شبكة/timeout) = warn فالسجل + undefined → fallback API.
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getRoSql, type RoSql } from './db-ro';

// ═══ ثوابت منسوخة حرفياً من server.js (مصدر واحد للحقيقة) ═══

// PDP_COLS_GUARANTEED — server.js:1302
const PDP_COLS_GUARANTEED = [
  'id', 'title', 'description', 'price', 'original_price', 'image_url',
  'images', 'variants', 'colors', 'sizes', 'category', 'video_url',
  'material', 'stock_status', 'cj_product_id', 'is_sourced', 'created_at',
  'seo_title', 'seo_meta_description',
];
// PDP_COLS_OPTIONAL — server.js:1303 (كيتكشفو من information_schema)
const PDP_COLS_OPTIONAL = ['patterns', 'colour_names', 'size_names', 'pattern', 'origin', 'composition'];

// PUBLIC_SETTING_KEYS / PUBLIC_LIST_KEYS — server.js:3845-3846
const PUBLIC_SETTING_KEYS = ['show_reels', 'show_lightning', 'show_fb', 'hidden_routes', 'hidden_sections'];
const PUBLIC_LIST_KEYS = ['hidden_routes', 'hidden_sections'];

// SW_SIZE_ONLY_RX / SW_MAX — server.js:2616/2620
const SW_SIZE_ONLY_RX = /^(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|\d{1,4})$/i;
const SW_MAX = 5;
// SW_SQL — server.js:2621 (نفس النص — swatches ديال كارتيك المنتوج)
const SW_SQL = `, COALESCE((
  SELECT json_agg(json_build_object('c', t.c, 'i', t.i, 'v', t.v) ORDER BY t.ord)
  FROM (
    SELECT regexp_replace(v.val->>'variantKey', '-[^-]+$', '') AS c,
           (array_agg(v.val->>'variantImage' ORDER BY v.ord))[1] AS i,
           (array_agg(v.val->>'vid' ORDER BY v.ord))[1] AS v,
           min(v.ord) AS ord
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(variants) = 'array' THEN variants ELSE '[]'::jsonb END) WITH ORDINALITY AS v(val, ord)
    WHERE COALESCE(v.val->>'variantImage', '') <> '' AND COALESCE(v.val->>'variantKey', '') <> ''
    GROUP BY 1
  ) t
), '[]'::json) AS swatches`;

const MINIMAL_CHUNK = 20000; // server.js — minimal chunked

// ═══ أدوات داخلية ═══

let pdpColsCache: string[] | null = null;
/** getPdpOptionalColumns — server.js:1305 (كشف متكيف، cache مرة لكل isolate)
 * 🩹 postgres.js + prepare:false — الـ array param كيمشي في Simple protocol:
 *    القائمة ثابتة من الكود → inline literals (بلا injection، بلا array param).
 */
async function pdpColumns(sql: RoSql): Promise<string[]> {
  if (pdpColsCache) return pdpColsCache;
  try {
    const rows = await sql.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('patterns','colour_names','size_names','pattern','origin','composition')",
    );
    pdpColsCache = PDP_COLS_GUARANTEED.concat(rows.map((r) => String(r.column_name)));
  } catch {
    pdpColsCache = PDP_COLS_GUARANTEED; // فشل الكشف → الأعمدة المضمونة فقط
  }
  return pdpColsCache;
}

/** withSwatches — server.js:2634 (نفس التحويل حرفياً) */
function withSwatches(rows: Record<string, unknown>[]): Record<string, unknown>[] {
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
    console.warn('[db-ro] withSwatches failed:', e instanceof Error ? e.message : e);
  }
  return rows;
}

// ═══ القراءات ═══

/**
 * مرآة GET /api/products/:id — الصف (مع images parsed) ولا null (404) ولا
 * undefined (DB غير متوفرة → المنادي كيرجع للـ API).
 */
export async function dbProduct(
  pid: number,
): Promise<Record<string, unknown> | null | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const cols = await pdpColumns(sql);
    const rows = await sql.unsafe(
      `SELECT ${cols.join(', ')} FROM products WHERE id = $1`,
      [pid],
    );
    if (rows.length === 0) return null;
    const p = { ...rows[0] };
    if (p.images && typeof p.images === 'string') {
      try { p.images = JSON.parse(p.images as string); } catch {
        // نفس سلوك الباك: serving raw string
        console.warn(`[db-ro] product #${pid} images JSON parse failed — serving raw string`);
      }
    }
    return p;
  } catch (e) {
    console.warn(`[db-ro] dbProduct(${pid}) failed — API fallback:`,
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products/:id/related — LIMIT 8 بثلاث مراحل (exact → base% → random).
 * product غير موجود = [] (الباك كيرجع 404 والفرونت كيحولها []).
 */
export async function dbRelated(
  pid: number,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const FIELDS = 'id, title, price, image_url, category';
    const prod = await sql.unsafe('SELECT category FROM products WHERE id = $1', [pid]);
    if (prod.length === 0) return [];
    const category = prod[0].category;
    const baseCategory = category ? String(category).split('-')[0] : '';

    let rows = await sql.unsafe(
      `SELECT ${FIELDS} FROM products
       WHERE id != $1 AND category = $2 AND stock_status = true
       ORDER BY id DESC LIMIT 8`,
      [pid, category],
    );
    if (rows.length < 8 && baseCategory) {
      const existingIds = rows.map((r) => Number(r.id));
      existingIds.push(pid);
      const more = await sql.unsafe(
        `SELECT ${FIELDS} FROM products
         WHERE id != ALL($1::int[]) AND category ILIKE $2 AND stock_status = true
         ORDER BY id DESC LIMIT $3`,
        [existingIds, `${baseCategory}%`, 8 - rows.length],
      );
      rows = [...rows, ...more];
    }
    if (rows.length < 8) {
      const existingIds = rows.map((r) => Number(r.id));
      existingIds.push(pid);
      const random = await sql.unsafe(
        `SELECT ${FIELDS} FROM products
         WHERE id != ALL($1::int[]) AND stock_status = true
         ORDER BY random() LIMIT $2`,
        [existingIds, 8 - rows.length],
      );
      rows = [...rows, ...random];
    }
    return rows;
  } catch (e) {
    console.warn(`[db-ro] dbRelated(${pid}) failed — API fallback:`,
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products?limit=N — نفس السقف 50 (F#55 AntiClone) + swatches
 * + created_at. undefined = DB غير متوفرة.
 */
export async function dbProductsLimit(
  limit: number,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const cap = Math.min(Math.max(1, Math.floor(limit) || 1), 50);
    const rows = await sql.unsafe(
      `SELECT id, title, price, original_price, image_url, category, video_url${SW_SQL}, created_at
       FROM products WHERE stock_status = true
       ORDER BY sort_order ASC, id DESC LIMIT ${cap}`,
    );
    return withSwatches(rows);
  } catch (e) {
    console.warn('[db-ro] dbProductsLimit failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/settings — القوائم JSON + الباقي boolean (نفس التحول حرفياً).
 * المفاتيح الغائبة كيبقاو غائبين (نفس سلوك الباك — الفرونت خدام على الحضور).
 */
export async function dbSettings(): Promise<Record<string, unknown> | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const rows = await sql.unsafe(
      // 🔑 ثوابت من الكود (PUBLIC_SETTING_KEYS) — inline literals بدل array param
      `SELECT key, value FROM store_settings WHERE key IN ('show_reels','show_lightning','show_fb','hidden_routes','hidden_sections')`,
    );
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      const key = String(row.key);
      if (PUBLIC_LIST_KEYS.includes(key)) {
        try {
          const p = Array.isArray(row.value) ? row.value : JSON.parse(String(row.value));
          settings[key] = Array.isArray(p)
            ? (p as unknown[]).filter((x) => typeof x === 'string').slice(0, 100)
            : [];
        } catch {
          settings[key] = [];
        }
      } else {
        settings[key] = row.value === 'true';
      }
    }
    return settings;
  } catch (e) {
    console.warn('[db-ro] dbSettings failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/categories/seo?slug= — كشف أعمدة seo_* متكيف (نفس candidates)
 * + سطر واحد بـ slug. found:false = جواب نهائي (ما كاينش fallback للـ API).
 */
export async function dbCategorySeo(
  slugPath: string,
): Promise<Record<string, unknown> | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  const raw = String(slugPath || '').toLowerCase().trim();
  const slug = raw.split('/').filter(Boolean).pop() || '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { found: false, slug };
  try {
    // getCategorySeoCols — نفس candidates بالحرف
    const colRows = await sql.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories' AND column_name LIKE 'seo_%'",
    );
    const cset = new Set(colRows.map((r) => String(r.column_name)));
    const pick = (...cands: string[]): string | null =>
      cands.find((x) => cset.has(x)) || null;
    const c = {
      title: pick('seo_title', 'seo_page_title', 'meta_title'),
      h1: pick('seo_h1', 'h1'),
      desc: pick('seo_meta_description', 'seo_description', 'meta_description', 'seo_desc'),
      content: pick('seo_content', 'seo_body', 'seo_text'),
      faqs: pick('seo_faqs', 'seo_faq', 'faqs'),
      version: pick('seo_content_version', 'content_version'),
    };
    const qi = (n: string) => '"' + n.replace(/"/g, '""') + '"';
    const sel = [
      c.title ? `${qi(c.title)} AS "seo_title"` : `NULL AS "seo_title"`,
      c.h1 ? `${qi(c.h1)} AS "seo_h1"` : `NULL AS "seo_h1"`,
      c.desc ? `${qi(c.desc)} AS "seo_meta_description"` : `NULL AS "seo_meta_description"`,
      c.content ? `${qi(c.content)} AS "seo_content"` : `NULL AS "seo_content"`,
      c.faqs ? `${qi(c.faqs)} AS "seo_faqs"` : `NULL AS "seo_faqs"`,
      c.version ? `${qi(c.version)} AS "seo_content_version"` : `NULL AS "seo_content_version"`,
    ].join(', ');
    const rows = await sql.unsafe(
      `SELECT slug, name, level, ${sel}
         FROM categories
        WHERE slug = $1
        ORDER BY level ASC, id ASC
        LIMIT 1`,
      [slug],
    );
    return rows.length
      ? { found: true, ...rows[0] }
      : { found: false, slug };
  } catch (e) {
    console.warn('[db-ro] dbCategorySeo failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products?minimal=1&page=N — {id, created_at} فقط (sitemap).
 * ⚠️ عمود category ما كاينش هنا — نفس الباك (الفلةترة المخفية fail-open).
 */
export async function dbProductsMinimal(
  page: number,
): Promise<
  { page: number; chunkSize: number; count: number; total: number; products: Record<string, unknown>[] } | undefined
> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const p = Math.max(1, Math.floor(page) || 1);
    const [rows, totalRows] = await Promise.all([
      sql.unsafe(
        `SELECT id, created_at FROM products WHERE stock_status = true
         ORDER BY id DESC LIMIT ${MINIMAL_CHUNK} OFFSET ${(p - 1) * MINIMAL_CHUNK}`,
      ),
      sql.unsafe('SELECT COUNT(*)::int AS total FROM products WHERE stock_status = true'),
    ]);
    return {
      page: p,
      chunkSize: MINIMAL_CHUNK,
      count: rows.length,
      total: Number(totalRows[0]?.total ?? 0),
      products: rows,
    };
  } catch (e) {
    console.warn('[db-ro] dbProductsMinimal failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 🆕 F107 CATALOG-LIVE (2026-11-19) — مرايا listing كاملة باش الرئيسية/
// الفئات/البحث/المفضلة يخدمو بلا Render. كل مرآة = نفس SQL حرفياً من
// server.js (المصدر: neo-store-backend-FIXED.zip — نفس قواعد الحرفية).
// ═════════════════════════════════════════════════════════════════════

// escapeLikeSafe — server.js:6
function escapeLikeSafe(s: string): string {
  return String(s).replace(/[\\%_]/g, '\\$&');
}
// CATALOG_SORTS — server.js:2900
const CATALOG_SORTS: Record<string, string> = {
  'price-asc': 'price ASC, id DESC',
  'price-desc': 'price DESC, id ASC',
  newest: 'created_at DESC, id DESC',
};
// SIZE_RX_SQL — server.js:2617
const SIZE_RX_SQL = '^(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|\\d{1,4})$';
// parsePriceParam — server.js:2905
function parsePriceParam(v: string | null): number | null {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : null;
}
// parseNamesParam — server.js:2917 (F#59 — نفس المنقّي حرفياً)
function parseNamesParam(v: string | null, isSize: boolean): string[] {
  const raw = String(v ?? '');
  if (!raw.trim()) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const c = part.trim().slice(0, 40);
    if (!c) continue;
    if (isSize ? !SW_SIZE_ONLY_RX.test(c) : SW_SIZE_ONLY_RX.test(c)) continue;
    seen.add(c);
    if (seen.size >= 8) break;
  }
  return [...seen];
}
// namesOrFrag — server.js:2944 (المسار القديم فقط — fastReady=false دايماً فالـ Worker)
function namesOrFrag(
  names: string[],
  params: unknown[],
  cfg: { extractSql: string; vocabGuard?: string },
): string {
  const ors = names.map((name) => {
    params.push(escapeLikeSafe(name));
    return `EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(variants) = 'array' THEN variants ELSE '[]'::jsonb END) cv(val)
      WHERE ${cfg.extractSql} ILIKE $${params.length}${cfg.vocabGuard || ''}
    )`;
  });
  return ors.length === 1 ? ors[0] : `(${ors.join(' OR ')})`;
}
// buildCatalogFilters — server.js:2959 (F#57-Phase2 + F#58/59 — نفس الفلاتر حرفياً)
function buildCatalogFilters(q: URLSearchParams, params: unknown[]): string[] {
  const frags: string[] = [];
  const minP = parsePriceParam(q.get('minPrice'));
  const maxP = parsePriceParam(q.get('maxPrice'));
  if (minP !== null || maxP !== null) frags.push('price > 0'); // FIX-ZERO
  if (minP !== null) { params.push(minP); frags.push(`price >= $${params.length}`); }
  if (maxP !== null) { params.push(maxP); frags.push(`price <= $${params.length}`); }
  const colours = parseNamesParam(q.get('colour'), false);
  if (colours.length) {
    frags.push(namesOrFrag(colours, params, {
      extractSql: "regexp_replace(cv.val->>'variantKey', '-[^-]+$', '')",
    }));
  }
  const sizes = parseNamesParam(q.get('size'), true);
  if (sizes.length) {
    frags.push(namesOrFrag(sizes, params, {
      extractSql: "regexp_replace(cv.val->>'variantKey', '^.*-', '')",
      vocabGuard: ` AND regexp_replace(cv.val->>'variantKey', '^.*-', '') ~* '${SIZE_RX_SQL}'`,
    }));
  }
  return frags;
}
// sortSqlFor — server.js:2989 (whitelist — بلا حقن)
function sortSqlFor(q: URLSearchParams): string | null {
  return CATALOG_SORTS[String(q.get('sort') || '').trim().toLowerCase()] || null;
}

const CATALOG_PER = 24; // server.js:3021

/**
 * مرآة GET /api/products?page=N — page mode (F#57 + mosaic md5).
 * category prefix ILIKE مع فلاتر price/colour/size/sort — نفس SQL حرفياً.
 */
export async function dbCatalogPage(
  q: URLSearchParams,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const cat = (q.get('category') || '').trim();
    const cols = `id, title, price, original_price, image_url, category, video_url${SW_SQL}`;
    // 🆕 category mode — فئات كبار بلا سقف (BL-CAT-SCROLL)
    if (cat && cat !== 'All') {
      const params: unknown[] = [`${escapeLikeSafe(cat)}%`];
      const whereExtra = buildCatalogFilters(q, params);
      const sortSql = sortSqlFor(q);
      const rows = await sql.unsafe(
        `SELECT ${cols}
         FROM products WHERE stock_status = true AND category ILIKE $1
         ${whereExtra.length ? 'AND ' + whereExtra.join(' AND ') : ''}
         ${sortSql ? 'ORDER BY ' + sortSql : 'ORDER BY sort_order ASC, id DESC'}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, CATALOG_PER, (page - 1) * CATALOG_PER],
      );
      return withSwatches(rows);
    }
    // 🆕 Temu-mosaic — homepage feed متنوع (deterministic md5 shuffle + tiebreaker)
    const mosaicParams: unknown[] = [];
    const mosaicWhere = buildCatalogFilters(q, mosaicParams);
    const mosaicSort = sortSqlFor(q);
    const rows = await sql.unsafe(
      `SELECT ${cols}
       FROM products WHERE stock_status = true
       ${mosaicWhere.length ? 'AND ' + mosaicWhere.join(' AND ') : ''}
       ORDER BY ${mosaicSort || 'md5(category || id::text), id DESC'}
       LIMIT $${mosaicParams.length + 1} OFFSET $${mosaicParams.length + 2}`,
      [...mosaicParams, CATALOG_PER, (page - 1) * CATALOG_PER],
    );
    return withSwatches(rows);
  } catch (e) {
    console.warn('[db-ro] dbCatalogPage failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products?count=1 — عدّاد الفئة الصادق (نفس فلاتر page-mode).
 */
export async function dbCatalogCount(
  q: URLSearchParams,
): Promise<{ count: number } | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const cat = (q.get('category') || '').trim();
    const countParams: unknown[] = [];
    const countWhere = buildCatalogFilters(q, countParams);
    let sqlText: string;
    let cParams: unknown[];
    if (cat && cat !== 'All') {
      cParams = [`${escapeLikeSafe(cat)}%`, ...countParams]; // FIX-LIKE
      sqlText = `SELECT COUNT(*)::int AS n FROM products WHERE stock_status = true AND category ILIKE $1${countWhere.length ? ' AND ' + countWhere.join(' AND ') : ''}`;
    } else {
      cParams = countParams;
      sqlText = `SELECT COUNT(*)::int AS n FROM products WHERE stock_status = true${countWhere.length ? ' AND ' + countWhere.join(' AND ') : ''}`;
    }
    const rows = await sql.unsafe(sqlText, cParams);
    return { count: Number(rows[0]?.n ?? 0) };
  } catch (e) {
    console.warn('[db-ro] dbCatalogCount failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products?search=... [&category=...] — بحث/تصنيف صارم
 * (server.js:3113 — exact OR prefix '/%' للفئة، ILIKE %q% للبحث، سقف 200).
 */
export async function dbCatalogSearch(
  q: URLSearchParams,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const search = q.get('search') || '';
    const category = q.get('category') || 'All';
    let query = `SELECT id, title, price, original_price, image_url, category, video_url${SW_SQL} FROM products WHERE stock_status = true`;
    const params: unknown[] = [];
    if (search) {
      params.push(`%${escapeLikeSafe(search)}%`); // FIX-LIKE
      query += ` AND title ILIKE $${params.length}`;
    }
    if (category !== 'All') {
      params.push(escapeLikeSafe(category)); // FIX-LIKE (exact ما يتأثرش)
      query += ` AND (category = $${params.length} OR category LIKE $${params.length} || '/%')`;
    }
    query += ` ORDER BY sort_order ASC, id DESC LIMIT 200`;
    const rows = await sql.unsafe(query, params);
    return withSwatches(rows);
  } catch (e) {
    console.warn('[db-ro] dbCatalogSearch failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة GET /api/products (bare — بلا limit) — سقف FULL_CAP=5000 (server.js:3100). */
export async function dbCatalogFull(): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const rows = await sql.unsafe(
      `SELECT id, title, price, original_price, image_url, category, video_url, created_at
       FROM products WHERE stock_status = true ORDER BY sort_order ASC, id DESC LIMIT 5000`,
    );
    return rows; // بلا سواتشات عمداً — نفس الباك (الفرع الكامل)
  } catch (e) {
    console.warn('[db-ro] dbCatalogFull failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة GET /api/products/deals — is_sourced=true سقف 10 (server.js:3170). */
export async function dbDeals(): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const rows = await sql.unsafe(
      'SELECT id, title, price, original_price, image_url FROM products WHERE stock_status = true AND is_sourced = true ORDER BY id DESC LIMIT 10',
    );
    return rows;
  } catch (e) {
    console.warn('[db-ro] dbDeals failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/products/by-ids — المفضلة (server.js:3146).
 * 🩹 array param مع prepare:false كيمشي بـ Simple protocol → inline literals
 *    (ints منقّيين فقط — نفس حرس FIX-IDS-BOUND — بلا injection ممكنة).
 */
export async function dbProductsByIds(
  idsParam: string,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const ids = String(idsParam || '')
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 2147483647)
      .slice(0, 100);
    if (ids.length === 0) return [];
    const rows = await sql.unsafe(
      `SELECT id, title, price, original_price, image_url, category, video_url${SW_SQL}
       FROM products
       WHERE stock_status = true AND id IN (${ids.join(',')})
       ORDER BY sort_order ASC, id DESC
       LIMIT 100`,
    );
    return withSwatches(rows);
  } catch (e) {
    console.warn('[db-ro] dbProductsByIds failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/**
 * مرآة GET /api/categories — شجرة الفئات + صورة ممثلة ذكية (LATERAL)
 * (categoryService.getCategoryTree:137 + التخصيب server.js:1593-1640).
 */
export async function dbCategoriesTree(): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const rows = await sql.unsafe(
      'SELECT id, level, name, slug, parent_id, cj_category_id FROM categories ORDER BY level ASC, name ASC',
    );
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      byId.set(String(row.id), {
        id: row.id, name: row.name, slug: row.slug,
        cjCategoryId: row.cj_category_id, children: [],
      });
    }
    const roots: Record<string, unknown>[] = [];
    for (const row of rows) {
      const node = byId.get(String(row.id));
      if (!node) continue;
      if (row.parent_id && byId.has(String(row.parent_id))) {
        (byId.get(String(row.parent_id))!.children as unknown[]).push(node);
      } else if (!row.parent_id) {
        roots.push(node);
      }
    }
    // 🆕 Temu-style rail: صورة ممثلة لكل فئة — نفس LATERAL حرفياً
    try {
      const imgs = await sql.unsafe(`
        SELECT c.slug, img.image_url
        FROM categories c
        LEFT JOIN LATERAL (
          SELECT p.image_url
          FROM products p
          WHERE p.stock_status = true
            AND p.image_url IS NOT NULL AND p.image_url <> ''
            AND (p.category = c.slug OR p.category LIKE c.slug || '-%' OR p.category LIKE c.slug || '/%')
          ORDER BY
            p.sort_order DESC NULLS LAST,
            p.is_sourced DESC,
            (p.video_url IS NOT NULL AND p.video_url <> '') DESC,
            COALESCE(array_length(p.images, 1), 0) DESC,
            p.id DESC
          LIMIT 1
        ) img ON true`);
      const imgMap = new Map<string, string | null>();
      for (const r of imgs) imgMap.set(String(r.slug), (r.image_url as string) ?? null);
      const attach = (nodes: Record<string, unknown>[]) => {
        for (const n of nodes || []) {
          if (!n?.slug) continue;
          n.image_url = imgMap.get(String(n.slug)) || null;
          const children = n.children as Record<string, unknown>[] | undefined;
          if (Array.isArray(children) && children.length) {
            attach(children);
            if (!n.image_url) n.image_url = children.find((c) => c.image_url)?.image_url || null;
          }
        }
      };
      attach(roots);
    } catch (e) {
      console.warn('[db-ro] categories image enrichment failed:',
        e instanceof Error ? e.message : e); // بلا صمت — الشجرة كترجع بلا صور
    }
    return roots;
  } catch (e) {
    console.warn('[db-ro] dbCategoriesTree failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة GET /api/search?q= — سقف 5 (server.js:2534 — نفس الـ escape [%_] حرفياً). */
export async function dbSearch(
  q: string,
): Promise<Record<string, unknown>[] | undefined> {
  const sql = await getRoSql();
  if (!sql) return undefined;
  try {
    const safe = String(q || '').replace(/[%_]/g, '\\$&'); // نفس hygiene الباك
    if (safe.length < 1) return [];
    const rows = await sql.unsafe(
      `SELECT id, title, price, image_url FROM products WHERE stock_status = true AND title ILIKE $1 ORDER BY id DESC LIMIT 5`,
      [`%${safe}%`],
    );
    return rows;
  } catch (e) {
    console.warn('[db-ro] dbSearch failed — API fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}
