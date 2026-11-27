// lib/d1.ts — 100% D1 — عميل الكاتالوگ على الحافة (binding DB → laclarc-catalog)
// ═══════════════════════════════════════════════════════════════════
// الجسر الوحيد بين الـ Worker و D1. الكتابات الحية (d1-realtime-sync) و
// قراءات phase-2 كتدوز من هنا. fail-open: بلا binding → null → المنادي
// كيرجع للمسار البديل (نفس عقد db-ro.ts).
//
// التفعيل: scripts/laclarc-d1-windows.ps1 → wrangler.jsonc ← binding "DB"
// ═══════════════════════════════════════════════════════════════════
import 'server-only';

// ─── أنواع هيكلية دنيا (بلا اعتماد على workers-types) ───
export interface D1PreparedStatementLike {
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
 * env.DB — laclarc-catalog. null = ما مربوطش بعد (جري laclarc-d1-windows.ps1
 * باش تفعّل الـ binding فwrangler.jsonc وتعمل push).
 * النتيجة كتخزن مرة وحدة لكل isolate (نفس نمط getRoSql).
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
    cachedD1 = null; // بلا context (build محلي / wrangler dev بلا binding) — fail-open
  }
  return cachedD1;
}

// ─── الأعمدة المسموحة (whitelist) — كل شيء آخر فالـ payload كيتخطى ───
// نفس أعمدة migrations/d1_schema.sql — مصدر واحد للحقيقة.
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
  return 1; // قيمة غريبة ماشي فارغة → نعتبروها موجودة (serving-safe)
};

/**
 * التحويل الآمن payload → صف D1 (defense-in-depth: حتى إلا الـ watcher خرّب
 * شي حاجة، هنا كيتنقّى كل شيء قبل ما يوصل لـ SQL).
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

/** upsert صف واحد — عقد INSERT/UPDATE ديال الـ watcher. كيرجع الـ id. */
export async function d1UpsertProduct(
  db: D1DatabaseLike,
  raw: Record<string, unknown>,
): Promise<{ id: number }> {
  const row = shapeProductRow(raw);
  const values = D1_PRODUCT_COLUMNS.map((c) => row[c]);
  await db.prepare(UPSERT_SQL).bind(...values).run();
  return { id: row.id as number };
}

/** حذف — كيرجع true إلا كان الصف حي فعلاً. */
export async function d1DeleteProduct(db: D1DatabaseLike, id: number): Promise<boolean> {
  const res = (await db
    .prepare('DELETE FROM products WHERE id = ?')
    .bind(id)
    .run()) as { meta?: { changes?: number } } | undefined;
  return (res?.meta?.changes ?? 0) > 0;
}

/** عدّاد الكاتالوگ — فحص الصحة بعد الـ push (المتوقع ≈ 54,367). */
export async function d1ProductCount(db: D1DatabaseLike): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>();
  return Number(r?.n ?? 0);
}

/** سجل الأحداث — نفس عقد system_events (كيتكتب غير الأخطاء باش نحافظو على الكوتا). */
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
    // fail-open — السجل ما يوقفش العملية
  }
}
