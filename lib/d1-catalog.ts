// lib/d1-catalog.ts — phase-2 100% D1 (2026-11-28) — قراءات الكاتالوگ من env.DB (laclarc-catalog)
// ═══════════════════════════════════════════════════════════════════════
// مرايا db-reads.ts بنفس الأشكال حرفياً — المصدر: D1 (SQLite dialect).
// العقد tri-state نفسو: undefined = D1 غير متوفرة/فشل → المنادي كيرجع
// للمسار القديم (Hyperdrive) — صفر regression على السلوك الحالي.
//
// الفرق عن Postgres (موثق):
//   · ILIKE   → LIKE (SQLite ASCII case-insensitive — نفس السلوك للسلاگات)
//   · md5(category||id::text) → hash رقمي deterministic (mosaic = تنويع فقط)
//   · jsonb_array_elements/regexp_replace → facets محسوبة مسبقاً
//     (facet_colors/facet_sizes/swatch_raw — عمّرتها backfill_facets.py
//     54,367/54,367 — الكتابة الجديدة كتحسبهم فshapeProductRow)
//   · information_schema → سكيما ثابتة (migrations/d1_schema.sql)
//   · text[] → JSON strings ولا ';'-joined — نرمالايزرز catalog-shared
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getD1, type D1DatabaseLike } from './d1';
import {
  withSwatches, escapeLikeSafe, parsePriceParam, parseNamesParam,
  CATALOG_SORTS, PUBLIC_SETTING_KEYS, PUBLIC_LIST_KEYS,
  PDP_COLS_GUARANTEED, PDP_COLS_OPTIONAL,
  parseJsonArrayCol, parseSemiArrayCol, parseJsonColKeepRaw,
  MINIMAL_CHUNK, CATALOG_PER,
} from './catalog-shared';

type Row = Record<string, unknown>;

async function d1All(db: D1DatabaseLike, sql: string, params: unknown[] = []): Promise<Row[]> {
  const res = (await db.prepare(sql).bind(...params).all<Row>()) as { results?: Row[] };
  return res?.results ?? [];
}

/** swatch_raw → swatches + withSwatches — كيمسح swatch_raw (shape drift حرس) */
function applySwatches(rows: Row[]): Row[] {
  for (const r of rows) {
    r.swatches = parseJsonArrayCol(r.swatch_raw as unknown);
    delete r.swatch_raw;
  }
  return withSwatches(rows);
}

/** PDP row → نفس شكل الباك: arrays JSON-parsed، booleans، ';'-arrays */
function shapePdp(row: Row): Row {
  const p: Row = { ...row };
  p.images = parseJsonColKeepRaw(p.images);
  p.variants = parseJsonColKeepRaw(p.variants);
  p.colors = parseJsonArrayCol(p.colors);
  p.sizes = parseJsonArrayCol(p.sizes);
  p.patterns = parseSemiArrayCol(p.patterns);
  p.colour_names = parseSemiArrayCol(p.colour_names);
  p.size_names = parseSemiArrayCol(p.size_names);
  p.stock_status = Boolean(p.stock_status);
  p.is_sourced = Boolean(p.is_sourced);
  return p;
}

/** فلاتر الكاتالوگ — مرآة buildCatalogFilters (facets بدل jsonb EXISTS) */
function buildCatalogFilters(q: URLSearchParams, params: unknown[]): string[] {
  const frags: string[] = [];
  const minP = parsePriceParam(q.get('minPrice'));
  const maxP = parsePriceParam(q.get('maxPrice'));
  if (minP !== null || maxP !== null) frags.push('price > 0'); // FIX-ZERO
  if (minP !== null) { params.push(minP); frags.push('price >= ?'); }
  if (maxP !== null) { params.push(maxP); frags.push('price <= ?'); }
  const colours = parseNamesParam(q.get('colour'), false);
  if (colours.length) {
    const ors = colours.map((name) => {
      params.push(`%|${escapeLikeSafe(name)}|%`);
      return 'facet_colors LIKE ? ESCAPE \'\\\'';
    });
    frags.push(ors.length === 1 ? ors[0] : `(${ors.join(' OR ')})`);
  }
  const sizes = parseNamesParam(q.get('size'), true);
  if (sizes.length) {
    const ors = sizes.map((name) => {
      params.push(`%|${escapeLikeSafe(name)}|%`);
      return 'facet_sizes LIKE ? ESCAPE \'\\\'';
    });
    frags.push(ors.length === 1 ? ors[0] : `(${ors.join(' OR ')})`);
  }
  return frags;
}

/** sortSqlFor — whitelist (بلا حقن) */
function sortSqlFor(q: URLSearchParams): string | null {
  return CATALOG_SORTS[String(q.get('sort') || '').trim().toLowerCase()] || null;
}

// mosaic — hash رقمي deterministic (بدل md5 — D1 ما فيهاش md5) — نفس الهدف: تنويع
const MOSAIC_ORDER =
  '(length(category) * 1000003 + unicode(substr(category, 1, 1)) * 131 + id * 2654435761) % 4294967296, id DESC';

// ═══ القراءات ═══

/** مرآة dbProduct — PDP كاملة من D1. null = 404 صادق. undefined = D1 غير متوفرة. */
export async function d1Product(pid: number): Promise<Row | null | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const cols = [...PDP_COLS_GUARANTEED, ...PDP_COLS_OPTIONAL].join(', ');
    const rows = await d1All(db, `SELECT ${cols} FROM products WHERE id = ? LIMIT 1`, [pid]);
    if (rows.length === 0) return null;
    return shapePdp(rows[0]);
  } catch (e) {
    console.warn(`[d1-catalog] d1Product(${pid}) failed — legacy fallback:`,
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbRelated — 3 مراحل (exact → base% → random) — LIMIT 8. */
export async function d1Related(pid: number): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const FIELDS = 'id, title, price, image_url, category';
    // stage1 — CTE واحدة (نفس بنيوية الباك — category كتندمج)
    let rows = await d1All(
      db,
      `WITH b AS (SELECT category FROM products WHERE id = ?)
       SELECT p.id, p.title, p.price, p.image_url, p.category, b.category AS __cat
       FROM products p CROSS JOIN b
       WHERE p.id != ? AND p.category = b.category AND p.stock_status = 1
       ORDER BY p.id DESC LIMIT 8`,
      [pid, pid],
    );
    let category: unknown;
    if (rows.length > 0) {
      category = rows[0].__cat;
      rows = rows.map(({ __cat: _c, ...r }) => r);
    } else {
      const prod = await d1All(db, 'SELECT category FROM products WHERE id = ? LIMIT 1', [pid]);
      if (prod.length === 0) return [];
      category = prod[0].category;
    }
    const baseCategory = category ? String(category).split('-')[0] : '';
    if (rows.length < 8 && baseCategory) {
      const existingIds = rows.map((r) => Number(r.id));
      existingIds.push(pid);
      const idList = existingIds.map((n) => Number.isInteger(n) && n > 0 ? Math.trunc(n) : 0).filter((n) => n > 0).join(',') || '0';
      const more = await d1All(
        db,
        `SELECT ${FIELDS} FROM products
         WHERE id NOT IN (${idList}) AND category LIKE ? ESCAPE '\\' AND stock_status = 1
         ORDER BY id DESC LIMIT ?`,
        [`${escapeLikeSafe(baseCategory)}%`, 8 - rows.length],
      );
      rows = [...rows, ...more];
    }
    if (rows.length < 8) {
      const existingIds = rows.map((r) => Number(r.id));
      existingIds.push(pid);
      const idList = existingIds.map((n) => Number.isInteger(n) && n > 0 ? Math.trunc(n) : 0).filter((n) => n > 0).join(',') || '0';
      const random = await d1All(
        db,
        `SELECT ${FIELDS} FROM products
         WHERE id NOT IN (${idList}) AND stock_status = 1
         ORDER BY RANDOM() LIMIT ?`,
        [8 - rows.length],
      );
      rows = [...rows, ...random];
    }
    return rows;
  } catch (e) {
    console.warn(`[d1-catalog] d1Related(${pid}) failed — legacy fallback:`,
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbProductsLimit — سقف 50 + swatches + created_at. */
export async function d1ProductsLimit(limit: number): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const cap = Math.min(Math.max(1, Math.floor(limit) || 1), 50);
    const rows = await d1All(
      db,
      `SELECT id, title, price, original_price, image_url, category, video_url, swatch_raw, created_at
       FROM products WHERE stock_status = 1
       ORDER BY sort_order ASC, id DESC LIMIT ?`,
      [cap],
    );
    return applySwatches(rows);
  } catch (e) {
    console.warn('[d1-catalog] d1ProductsLimit failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbSettings — store_settings من D1 (الجدول كيتعمر بpush-categories-settings.mjs). */
export async function d1Settings(): Promise<Row | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const inList = PUBLIC_SETTING_KEYS.map((k) => `'${k.replace(/'/g, "''")}'`).join(',');
    const rows = await d1All(db, `SELECT key, value FROM store_settings WHERE key IN (${inList})`);
    const settings: Row = {};
    for (const row of rows) {
      const key = String(row.key);
      if (PUBLIC_LIST_KEYS.includes(key)) {
        try {
          const parsed = Array.isArray(row.value) ? row.value : JSON.parse(String(row.value));
          settings[key] = Array.isArray(parsed)
            ? (parsed as unknown[]).filter((x) => typeof x === 'string').slice(0, 100)
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
    console.warn('[d1-catalog] d1Settings failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCategorySeo — سطر واحد بslug من categories (D1). */
export async function d1CategorySeo(slugPath: string): Promise<Row | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  const raw = String(slugPath || '').toLowerCase().trim();
  const slug = raw.split('/').filter(Boolean).pop() || '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { found: false, slug };
  try {
    const rows = await d1All(
      db,
      `SELECT slug, name, level,
              seo_title AS "seo_title", seo_h1 AS "seo_h1",
              seo_meta_description AS "seo_meta_description",
              seo_content AS "seo_content", seo_faqs AS "seo_faqs",
              seo_content_version AS "seo_content_version"
         FROM categories
        WHERE slug = ?
        ORDER BY level ASC, id ASC
        LIMIT 1`,
      [slug],
    );
    return rows.length ? { found: true, ...rows[0] } : { found: false, slug };
  } catch (e) {
    console.warn('[d1-catalog] d1CategorySeo failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbProductsMinimal — {id, created_at} chunks (sitemap). */
export async function d1ProductsMinimal(
  page: number,
): Promise<{ page: number; chunkSize: number; count: number; total: number; products: Row[] } | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const p = Math.max(1, Math.floor(page) || 1);
    const rows = await d1All(
      db,
      `SELECT id, created_at FROM products WHERE stock_status = 1
       ORDER BY sales_count DESC, id DESC
       LIMIT ${MINIMAL_CHUNK} OFFSET ${(p - 1) * MINIMAL_CHUNK}`,
    );
    const totalRows = await d1All(db, 'SELECT COUNT(*) AS total FROM products WHERE stock_status = 1');
    return {
      page: p,
      chunkSize: MINIMAL_CHUNK,
      count: rows.length,
      total: Number(totalRows[0]?.total ?? 0),
      products: rows,
    };
  } catch (e) {
    console.warn('[d1-catalog] d1ProductsMinimal failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCatalogPage — page mode (category) + mosaic — نفس الفلاتر حرفياً. */
export async function d1CatalogPage(q: URLSearchParams): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const cat = (q.get('category') || '').trim();
    const cols = 'id, title, price, original_price, image_url, category, video_url, swatch_raw';
    if (cat && cat !== 'All') {
      const params: unknown[] = [`${escapeLikeSafe(cat)}%`];
      const whereExtra = buildCatalogFilters(q, params);
      const sortSql = sortSqlFor(q);
      params.push(CATALOG_PER, (page - 1) * CATALOG_PER);
      const rows = await d1All(
        db,
        `SELECT ${cols}
         FROM products WHERE stock_status = 1 AND category LIKE ? ESCAPE '\\'
         ${whereExtra.length ? 'AND ' + whereExtra.join(' AND ') : ''}
         ${sortSql ? 'ORDER BY ' + sortSql : 'ORDER BY sort_order ASC, id DESC'}
         LIMIT ? OFFSET ?`,
        params,
      );
      return applySwatches(rows);
    }
    const mosaicParams: unknown[] = [];
    const mosaicWhere = buildCatalogFilters(q, mosaicParams);
    const mosaicSort = sortSqlFor(q);
    mosaicParams.push(CATALOG_PER, (page - 1) * CATALOG_PER);
    const rows = await d1All(
      db,
      `SELECT ${cols}
       FROM products WHERE stock_status = 1
       ${mosaicWhere.length ? 'AND ' + mosaicWhere.join(' AND ') : ''}
       ORDER BY ${mosaicSort || MOSAIC_ORDER}
       LIMIT ? OFFSET ?`,
      mosaicParams,
    );
    return applySwatches(rows);
  } catch (e) {
    console.warn('[d1-catalog] d1CatalogPage failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCatalogCount — عدّاد الفئة الصادق. */
export async function d1CatalogCount(q: URLSearchParams): Promise<{ count: number } | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const cat = (q.get('category') || '').trim();
    const countParams: unknown[] = [];
    const countWhere = buildCatalogFilters(q, countParams);
    let sqlText: string;
    let cParams: unknown[];
    if (cat && cat !== 'All') {
      cParams = [`${escapeLikeSafe(cat)}%`, ...countParams]; // FIX-LIKE
      sqlText = `SELECT COUNT(*) AS n FROM products WHERE stock_status = 1 AND category LIKE ? ESCAPE '\\'${countWhere.length ? ' AND ' + countWhere.join(' AND ') : ''}`;
    } else {
      cParams = countParams;
      sqlText = `SELECT COUNT(*) AS n FROM products WHERE stock_status = 1${countWhere.length ? ' AND ' + countWhere.join(' AND ') : ''}`;
    }
    const rows = await d1All(db, sqlText, cParams);
    return { count: Number(rows[0]?.n ?? 0) };
  } catch (e) {
    console.warn('[d1-catalog] d1CatalogCount failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCatalogSearch — بحث/تصنيف صارم — سقف 200. */
export async function d1CatalogSearch(q: URLSearchParams): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const search = q.get('search') || '';
    const category = q.get('category') || 'All';
    let query = `SELECT id, title, price, original_price, image_url, category, video_url, swatch_raw FROM products WHERE stock_status = 1`;
    const params: unknown[] = [];
    if (search) {
      params.push(`%${escapeLikeSafe(search)}%`); // FIX-LIKE
      query += ` AND title LIKE ? ESCAPE '\\'`;
    }
    if (category !== 'All') {
      const esc = escapeLikeSafe(category);
      params.push(esc, `${esc}/%`);
      query += ` AND (category = ? OR category LIKE ? ESCAPE '\\')`;
    }
    query += ` ORDER BY sort_order ASC, id DESC LIMIT 200`;
    const rows = await d1All(db, query, params);
    return applySwatches(rows);
  } catch (e) {
    console.warn('[d1-catalog] d1CatalogSearch failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCatalogFull — bare — سقف 5000 — بلا سواتشات عمداً (نفس الباك). */
export async function d1CatalogFull(): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    return await d1All(
      db,
      `SELECT id, title, price, original_price, image_url, category, video_url, created_at
       FROM products WHERE stock_status = 1 ORDER BY sort_order ASC, id DESC LIMIT 5000`,
    );
  } catch (e) {
    console.warn('[d1-catalog] d1CatalogFull failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbDeals — is_sourced سقف 10. */
export async function d1Deals(): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    return await d1All(
      db,
      'SELECT id, title, price, original_price, image_url FROM products WHERE stock_status = 1 AND is_sourced = 1 ORDER BY id DESC LIMIT 10',
    );
  } catch (e) {
    console.warn('[d1-catalog] d1Deals failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbProductsByIds — المفضلة — سقف 100. */
export async function d1ProductsByIds(idsParam: string): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const ids = String(idsParam || '')
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 2147483647)
      .slice(0, 100);
    if (ids.length === 0) return [];
    const rows = await d1All(
      db,
      `SELECT id, title, price, original_price, image_url, category, video_url, swatch_raw
       FROM products
       WHERE stock_status = 1 AND id IN (${ids.join(',')})
       ORDER BY sort_order ASC, id DESC
       LIMIT 100`,
    );
    return applySwatches(rows);
  } catch (e) {
    console.warn('[d1-catalog] d1ProductsByIds failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbCategoriesTree — شجرة الفئات + صور ممثلة (categories + category_images). */
export async function d1CategoriesTree(): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const rows = await d1All(
      db,
      'SELECT id, level, name, slug, parent_id, cj_category_id FROM categories ORDER BY level ASC, name ASC',
    );
    if (rows.length === 0) return undefined; // جدول خاوي = push مازال — legacy fallback
    const byId = new Map<string, Row>();
    for (const row of rows) {
      byId.set(String(row.id), {
        id: row.id, name: row.name, slug: row.slug,
        cjCategoryId: row.cj_category_id, children: [],
      });
    }
    const roots: Row[] = [];
    for (const row of rows) {
      const node = byId.get(String(row.id));
      if (!node) continue;
      if (row.parent_id && byId.has(String(row.parent_id))) {
        (byId.get(String(row.parent_id))!.children as unknown[]).push(node);
      } else if (!row.parent_id) {
        roots.push(node);
      }
    }
    // صور ممثلة — category_images (مرآة category_images_mv — نفس الشكل slug/image_url)
    try {
      const imgs = await d1All(db, 'SELECT slug, image_url FROM category_images');
      const imgMap = new Map<string, string | null>();
      for (const r of imgs) imgMap.set(String(r.slug), (r.image_url as string) ?? null);
      const attach = (nodes: Row[]) => {
        for (const n of nodes || []) {
          if (!n?.slug) continue;
          n.image_url = imgMap.get(String(n.slug)) || null;
          const children = n.children as Row[] | undefined;
          if (Array.isArray(children) && children.length) {
            attach(children);
            if (!n.image_url) n.image_url = children.find((c) => c.image_url)?.image_url || null;
          }
        }
      };
      attach(roots);
    } catch (e) {
      console.warn('[d1-catalog] categories image enrichment failed:',
        e instanceof Error ? e.message : e); // بلا صمت — الشجرة كترجع بلا صور
    }
    return roots;
  } catch (e) {
    console.warn('[d1-catalog] d1CategoriesTree failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** مرآة dbSearch — سقف 5. */
export async function d1Search(q: string): Promise<Row[] | undefined> {
  const db = await getD1();
  if (!db) return undefined;
  try {
    const safe = String(q || '').replace(/[%_]/g, '\\$&'); // نفس hygiene الباك
    if (safe.length < 1) return [];
    return await d1All(
      db,
      `SELECT id, title, price, image_url FROM products WHERE stock_status = 1 AND title LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 5`,
      [`%${safe}%`],
    );
  } catch (e) {
    console.warn('[d1-catalog] d1Search failed — legacy fallback:',
      e instanceof Error ? e.message : e);
    return undefined;
  }
}
