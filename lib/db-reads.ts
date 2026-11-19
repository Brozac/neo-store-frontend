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
