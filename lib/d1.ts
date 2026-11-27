// lib/d1.ts â€” 100% D1 â€” ط¹ظ…ظٹظ„ ط§ظ„ظƒط§طھط§ظ„ظˆع¯ ط¹ظ„ظ‰ ط§ظ„ط­ط§ظپط© (binding DB â†’ laclarc-catalog)
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// ط§ظ„ط¬ط³ط± ط§ظ„ظˆط­ظٹط¯ ط¨ظٹظ† ط§ظ„ظ€ Worker ظˆ D1. ط§ظ„ظƒطھط§ط¨ط§طھ ط§ظ„ط­ظٹط© (d1-realtime-sync) ظˆ
// ظ‚ط±ط§ط،ط§طھ phase-2 ظƒطھط¯ظˆط² ظ…ظ† ظ‡ظ†ط§. fail-open: ط¨ظ„ط§ binding â†’ null â†’ ط§ظ„ظ…ظ†ط§ط¯ظٹ
// ظƒظٹط±ط¬ط¹ ظ„ظ„ظ…ط³ط§ط± ط§ظ„ط¨ط¯ظٹظ„ (ظ†ظپط³ ط¹ظ‚ط¯ db-ro.ts).
//
// ط§ظ„طھظپط¹ظٹظ„: scripts/laclarc-d1-windows.ps1 â†’ wrangler.jsonc â†گ binding "DB"
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
import 'server-only';

// â”€â”€â”€ ط£ظ†ظˆط§ط¹ ظ‡ظٹظƒظ„ظٹط© ط¯ظ†ظٹط§ (ط¨ظ„ط§ ط§ط¹طھظ…ط§ط¯ ط¹ظ„ظ‰ workers-types) â”€â”€â”€
export interface D1PreparedStatementLike {
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results?: T[] }>;
  };
}
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

let cachedD1: D1DatabaseLike | null | undefined;

/**
 * env.DB â€” laclarc-catalog. null = ظ…ط§ ظ…ط±ط¨ظˆط·ط´ ط¨ط¹ط¯ (ط¬ط±ظٹ laclarc-d1-windows.ps1
 * ط¨ط§ط´ طھظپط¹ظ‘ظ„ ط§ظ„ظ€ binding ظپwrangler.jsonc ظˆطھط¹ظ…ظ„ push).
 * ط§ظ„ظ†طھظٹط¬ط© ظƒطھط®ط²ظ† ظ…ط±ط© ظˆط­ط¯ط© ظ„ظƒظ„ isolate (ظ†ظپط³ ظ†ظ…ط· getRoSql).
 */
export async function getD1(): Promise<D1DatabaseLike | null> {
  if (cachedD1 !== undefined) return cachedD1;
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const db = env?.DB as D1DatabaseLike | undefined;
    cachedD1 = db && typeof db.prepare === 'function' ? db : null;
  } catch {
    cachedD1 = null; // ط¨ظ„ط§ context (build ظ…ط­ظ„ظٹ / wrangler dev ط¨ظ„ط§ binding) â€” fail-open
  }
  return cachedD1;
}

// â”€â”€â”€ ط§ظ„ط£ط¹ظ…ط¯ط© ط§ظ„ظ…ط³ظ…ظˆط­ط© (whitelist) â€” ظƒظ„ ط´ظٹط، ط¢ط®ط± ظپط§ظ„ظ€ payload ظƒظٹطھط®ط·ظ‰ â”€â”€â”€
// ظ†ظپط³ ط£ط¹ظ…ط¯ط© migrations/d1_schema.sql â€” ظ…طµط¯ط± ظˆط§ط­ط¯ ظ„ظ„ط­ظ‚ظٹظ‚ط©.
export const D1_PRODUCT_COLUMNS = [
  'id', 'title', 'description', 'price', 'original_price', 'image_url',
  'images', 'variants', 'colors', 'sizes', 'patterns', 'colour_names', 'size_names',
  'pattern', 'origin', 'composition', 'category', 'video_url', 'material',
  'stock_status', 'sort_order', 'sales_count', 'cj_product_id', 'is_sourced',
  'seo_title', 'seo_meta_description', 'created_at', 'updated_at',
] as const;

const JSON_ARRAY_COLS = new Set([
  'images', 'variants', 'colors', 'sizes', 'patterns', 'colour_names', 'size_names',
]);

const asText = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);

const asJsonText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return null; }
};

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const asBool01 = (v: unknown): number => {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === null || v === undefined) return 0;
  return 1; // ظ‚ظٹظ…ط© ط؛ط±ظٹط¨ط© ظ…ط§ط´ظٹ ظپط§ط±ط؛ط© â†’ ظ†ط¹طھط¨ط±ظˆظ‡ط§ ظ…ظˆط¬ظˆط¯ط© (serving-safe)
};

/**
 * ط§ظ„طھط­ظˆظٹظ„ ط§ظ„ط¢ظ…ظ† payload â†’ طµظپ D1 (defense-in-depth: ط­طھظ‰ ط¥ظ„ط§ ط§ظ„ظ€ watcher ط®ط±ظ‘ط¨
 * ط´ظٹ ط­ط§ط¬ط©طŒ ظ‡ظ†ط§ ظƒظٹطھظ†ظ‚ظ‘ظ‰ ظƒظ„ ط´ظٹط، ظ‚ط¨ظ„ ظ…ط§ ظٹظˆطµظ„ ظ„ظ€ SQL).
 */
export function shapeProductRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of D1_PRODUCT_COLUMNS) {
    const v = raw[col];
    if (col === 'id') {
      const n = asNumber(v);
      out.id = n === null ? null : Math.trunc(n);
      continue;
    }
    if (JSON_ARRAY_COLS.has(col)) { out[col] = asJsonText(v); continue; }
    if (col === 'price' || col === 'original_price') { out[col] = asNumber(v); continue; }
    if (col === 'stock_status' || col === 'is_sourced') { out[col] = asBool01(v); continue; }
    if (col === 'sort_order' || col === 'sales_count') {
      const n = asNumber(v);
      out[col] = n === null ? 0 : Math.trunc(n);
      continue;
    }
    out[col] = asText(v);
  }
  const id = out.id as number | null;
  if (id === null || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw new Error(`d1: invalid product id (${String(raw.id)})`);
  }
  return out;
}

const UPSERT_SQL =
  `INSERT INTO products (${D1_PRODUCT_COLUMNS.join(', ')})
VALUES (${D1_PRODUCT_COLUMNS.map(() => '?').join(', ')})
ON CONFLICT(id) DO UPDATE SET
${D1_PRODUCT_COLUMNS
    .filter((c) => c !== 'id')
    .map((c) => `  ${c} = excluded.${c}`)
    .join(',\n')}`;

/** upsert طµظپ ظˆط§ط­ط¯ â€” ط¹ظ‚ط¯ INSERT/UPDATE ط¯ظٹط§ظ„ ط§ظ„ظ€ watcher. ظƒظٹط±ط¬ط¹ ط§ظ„ظ€ id. */
export async function d1UpsertProduct(
  db: D1DatabaseLike,
  raw: Record<string, unknown>,
): Promise<{ id: number }> {
  const row = shapeProductRow(raw);
  const values = D1_PRODUCT_COLUMNS.map((c) => row[c]);
  await db.prepare(UPSERT_SQL).bind(...values).run();
  return { id: row.id as number };
}

/** ط­ط°ظپ â€” ظƒظٹط±ط¬ط¹ true ط¥ظ„ط§ ظƒط§ظ† ط§ظ„طµظپ ط­ظٹ ظپط¹ظ„ط§ظ‹. */
export async function d1DeleteProduct(db: D1DatabaseLike, id: number): Promise<boolean> {
  const res = (await db
    .prepare('DELETE FROM products WHERE id = ?')
    .bind(id)
    .run()) as { meta?: { changes?: number } } | undefined;
  return (res?.meta?.changes ?? 0) > 0;
}

/** ط¹ط¯ظ‘ط§ط¯ ط§ظ„ظƒط§طھط§ظ„ظˆع¯ â€” ظپط­طµ ط§ظ„طµط­ط© ط¨ط¹ط¯ ط§ظ„ظ€ push (ط§ظ„ظ…طھظˆظ‚ط¹ â‰ˆ 54,367). */
export async function d1ProductCount(db: D1DatabaseLike): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>();
  return Number(r?.n ?? 0);
}

/** ط³ط¬ظ„ ط§ظ„ط£ط­ط¯ط§ط« â€” ظ†ظپط³ ط¹ظ‚ط¯ system_events (ظƒظٹطھظƒطھط¨ ط؛ظٹط± ط§ظ„ط£ط®ط·ط§ط، ط¨ط§ط´ ظ†ط­ط§ظپط¸ظˆ ط¹ظ„ظ‰ ط§ظ„ظƒظˆطھط§). */
export async function d1LogEvent(
  db: D1DatabaseLike,
  eventType: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    await db
      .prepare('INSERT INTO system_events (event_type, details, severity) VALUES (?, ?, ?)')
      .bind(String(eventType).slice(0, 120), JSON.stringify(details), severity)
      .run();
  } catch {
    // fail-open â€” ط§ظ„ط³ط¬ظ„ ظ…ط§ ظٹظˆظ‚ظپط´ ط§ظ„ط¹ظ…ظ„ظٹط©
  }
}

