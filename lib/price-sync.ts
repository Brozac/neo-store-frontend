// lib/price-sync.ts — phase-abc: تزامن الأسعار/الستوك مع CJ كل 6 ساعات (البند 7b)
// ═══════════════════════════════════════════════════════════════════════
// العقد من الـ prompt المعتمد: runDailyPriceSync(25) — دورة عادلة بلا random():
//   · الدفعة: ORDER BY updated_at ASC NULLS FIRST LIMIT 25 — الأقدم كيأول
//     (عدالة دوران — 100 منتج/يوم → الكاطوگ كيتدور تدريجياً)
//   · الحماية من الـ dead tuples: UPDATE فقط WHERE
//     price IS DISTINCT FROM $new OR stock_status IS DISTINCT FROM $new
//     (لا كتابة إلا قيمة تغيرت فعلاً — Postgres ما كيفتحش صفوف ميتة بلا سبب)
//   · updated_at = now() عند التغير فقط — الدفعة القادمة كتلف على غيرهم
//   · purge: bump نسخة edge-cache مرة واحدة إذا كاين تغيير + zone purge
//     للـ URLs المتأثرة (≤25 — سقف CF API هو 30)
// ═══════════════════════════════════════════════════════════════════════
import { cjFetch, calculateSellingPrice } from './cf-cj';
import { openRwSql, logSystemEvent } from './cron-db';

const BATCH = 200;

export interface PriceSyncResult {
  ok: boolean;
  checked: number;
  updated: number;
  cachePurged: boolean;
  ms: number;
  error?: string;
}

interface CjVariantInv {
  vid?: string;
  inventories?: { inventoryQuantity?: string | number; warehouseCode?: string }[];
  sellPrice?: string | number;
}

interface CjQueryProduct {
  pid?: string;
  sellPrice?: string | number;
  productWeight?: string | number;
  variants?: CjVariantInv[];
}

/** هل المنتج متوفر؟ CJ variant → inventories → inventoryQuantity — fail-open fallback */
function computeStock(variants: CjVariantInv[] | undefined, fallback: boolean): boolean {
  if (!Array.isArray(variants) || variants.length === 0) return fallback;
  for (const v of variants) {
    const invs = Array.isArray(v?.inventories) ? v!.inventories! : [];
    for (const inv of invs) {
      const q = Number(inv?.inventoryQuantity ?? 0);
      if (Number.isFinite(q) && q > 0) return true;
    }
  }
  // كل الـ inventories أرقامها 0/فاضية → نافد — إلا مانقدرش نقرا → الحالة القديمة
  const anyInv = variants.some((v) => Array.isArray(v?.inventories) && v.inventories!.length > 0);
  return anyInv ? false : fallback;
}

/** purge zone cache بالـ URLs الدقيقة — نفس عقد /api/edge-cache-purge (origin-locked) */
export async function purgeZoneFiles(productIds: number[]): Promise<boolean> {
  const token = (process.env.EDGE_PURGE_API_TOKEN || '').trim();
  if (!token || productIds.length === 0) return false;
  const files: string[] = [];
  for (const origin of ['https://laclarc.com', 'https://www.laclarc.com']) {
    for (const id of productIds) {
      files.push(`${origin}/api/products/${id}`, `${origin}/api/products/${id}/related`);
      if (files.length >= 30) break;
    }
    if (files.length >= 30) break;
  }
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones/234ef6b0c01d0cb85553852a4d0b79a3/purge_cache', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files }),
      signal: AbortSignal.timeout(10000),
    });
    const j = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return j?.success === true;
  } catch {
    return false;
  }
}

/** bump نسخة edge-cache من env مباشر (بلا getCloudflareContext — سياق كرون) */
export async function bumpVersionFromEnv(env: CfCronEnv): Promise<boolean> {
  const kv = (env.STORE_KV || env.NEXT_INC_CACHE_KV) as
    | { put?: (k: string, v: string) => Promise<void> }
    | undefined;
  if (!kv || typeof kv.put !== 'function') return false;
  try {
    await kv.put('edgecache:catalog_version', `v${Date.now().toString(36)}`);
    return true;
  } catch {
    return false;
  }
}

/** شكل SQL لعميل كرون/ويبهوك — نفس interface ديال CronSql بلا import دائري */
export interface SyncSqlClient {
  unsafe(q: string, p?: unknown[]): Promise<Record<string, unknown>[]>;
}

/**
 * تزامن منتج واحد من CJ — استجواب حي + كتابة مشروطة (ضد dead tuples).
 * مشترك بين cron (runDailyPriceSync) و CJ webhook (PRODUCT/VARIANT/STOCK).
 * @returns true إلا تحدث كتابة فعليّة (القيمة تبدلت)
 */
export async function syncOneProductFromCj(
  sql: SyncSqlClient,
  id: number,
  pid: string,
  currentStock: boolean,
): Promise<boolean> {
  const res = await cjFetch('/product/query', { query: { pid } });
  const envData = res.data;
  const p = (envData?.code === 200 ? envData?.data ?? null : null) as CjQueryProduct | null;
  if (!p || !p.pid) throw new Error('cj_query_empty');

  const pricing = calculateSellingPrice(p.sellPrice, Number(p.productWeight) || 0, null);
  const newPrice = pricing.safePrice;
  const newOriginal = pricing.safeOriginalPrice;
  const newStock = computeStock(p.variants, currentStock);

  // الكتابة الذرية المشروطة — القيم لم تتحرك = صفر كتابة = صفر dead tuples
  const upd = await sql.unsafe(
    `UPDATE products
     SET price = $1, original_price = $2, stock_status = $3, updated_at = now()
     WHERE id = $4
       AND (price IS DISTINCT FROM $1
            OR original_price IS DISTINCT FROM $2
            OR stock_status IS DISTINCT FROM $3)
     RETURNING id`,
    [newPrice, newOriginal, newStock, id],
  );
  return upd.length > 0;
}

// ═══ 🚀 PERF goal-4 (2026-11-24): SWR ديال الثمن عند الزيارة ═══
// PDP/beacon كيشعل تحديث CJ للمنتج المزار فقط — عينة 10% + guard updated_at > 6h
// + قاطع دائرة (3 إخفاقات = off 10 دقايق) + dedupe لكل isolate. بلا version bump
// (باش ما نهدموش كاش الحافة العالمي) — غير zone purge للـ URL ديال المنتج المحدّث.
let _breaker = { fails: 0, openUntil: 0 };
const _recent = new Map<number, number>();

export async function refreshPriceOnVisit(
  pid: number,
  env: CfCronEnv,
): Promise<void> {
  const now = Date.now();
  if (now < _breaker.openUntil) return;
  if (Math.random() >= 0.10) return; // عينة 10% — حماية CJ rate-limit
  if (now - (_recent.get(pid) ?? 0) < 10 * 60_000) return; // مرة/10د لكل isolate
  _recent.set(pid, now);
  if (_recent.size > 500) {
    for (const [k, t] of _recent) { if (now - t > 10 * 60_000) _recent.delete(k); }
    if (_recent.size > 500) _recent.clear();
  }
  const sql = await openRwSql(env);
  if (!sql) return;
  try {
    // guard: غير المنتجات القديمة تحديثاً (سطر مفهرس واحد) — كيمنع burn ديال CJ
    const rows = await sql.unsafe(
      `SELECT id, cj_product_id, stock_status FROM products
       WHERE id = $1 AND cj_product_id IS NOT NULL AND cj_product_id <> ''
         AND updated_at < now() - interval '6 hours'`,
      [pid],
    );
    if (rows.length === 0) return;
    const row = rows[0];
    const changed = await syncOneProductFromCj(
      sql, Number(row.id), String(row.cj_product_id), Boolean(row.stock_status),
    );
    if (changed) await purgeZoneFiles([Number(row.id)]);
    _breaker.fails = 0;
  } catch (e) {
    _breaker.fails += 1;
    if (_breaker.fails >= 3) {
      _breaker.openUntil = Date.now() + 10 * 60_000;
      _breaker.fails = 0;
      console.warn('[price-sync] visit-refresh circuit OPEN 10min:',
        e instanceof Error ? e.message : String(e));
    }
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}

export async function runDailyPriceSync(env: CfCronEnv, batchSize = BATCH): Promise<PriceSyncResult> {
  const t0 = Date.now();
  const base: PriceSyncResult = { ok: false, checked: 0, updated: 0, cachePurged: false, ms: 0 };
  const sql = await openRwSql(env);
  if (!sql) return { ...base, ms: Date.now() - t0, error: 'rw_unavailable' };

  try {
    // 1) الدفعة — دورة عادلة: الأقدم تحديثاً كيأول
    const rows = await sql.unsafe(
      `SELECT id, cj_product_id, price, original_price, stock_status
       FROM products
       WHERE cj_product_id IS NOT NULL AND cj_product_id <> ''
       ORDER BY updated_at ASC NULLS FIRST
       LIMIT ${Math.max(1, Math.floor(batchSize) || BATCH)}`,
    );
    if (rows.length === 0) {
      await logSystemEvent(sql, 'PRICE_SYNC_DONE', { checked: 0, updated: 0 }, 'info');
      return { ...base, ok: true, ms: Date.now() - t0 };
    }

    const changedIds: number[] = [];
    let checked = 0;
    let cjFailures = 0;

    for (const row of rows) {
      const pid = String(row.cj_product_id ?? '').trim();
      const id = Number(row.id);
      if (!pid || !Number.isFinite(id)) continue;
      checked++;
      try {
        const updated = await syncOneProductFromCj(sql, id, pid, Boolean(row.stock_status));
        if (updated) changedIds.push(id);
      } catch (e) {
        cjFailures++;
        console.warn(
          `[price-sync] product #${id} (${pid}) failed:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    // 2) purge — فقط إذا كاين تغيير فعلي
    let cachePurged = false;
    if (changedIds.length > 0) {
      cachePurged = await bumpVersionFromEnv(env);
      const zoned = await purgeZoneFiles(changedIds);
      cachePurged = cachePurged || zoned;
    }

    // 🚀 PERF 2026-11-24: عمّر category_images_mv (بديل الـ LATERAL 32s/نداء) — best-effort
    //    بلا ما يطيح السينك إلا فشل (fail-open، نفس عقد الـ purge).
    try {
      await sql.unsafe('SELECT refresh_category_images()');
    } catch (mvErr) {
      console.warn('[price-sync] category_images_mv refresh failed (fail-open):',
        mvErr instanceof Error ? mvErr.message : String(mvErr));
    }

    await logSystemEvent(
      sql,
      'PRICE_SYNC_DONE',
      { checked, updated: changedIds.length, changedIds: changedIds.slice(0, 25), cjFailures, cachePurged },
      'info',
    );
    return {
      ok: true,
      checked,
      updated: changedIds.length,
      cachePurged,
      ms: Date.now() - t0,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[price-sync] failed:', msg);
    return { ...base, ms: Date.now() - t0, error: msg };
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}
