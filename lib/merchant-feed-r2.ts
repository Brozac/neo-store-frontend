// lib/merchant-feed-r2.ts — phase-abc: توليد merchant feeds ورفعها إلى R2 (البند 6)
// ═══════════════════════════════════════════════════════════════════════
// الحقيقة الحية (audit 2026-11-23): الـ merchant feed ميت 404 في كل العناوين
//   (api/laclarc/rpc/usd) — قناة Google Shopping واقفة. السبب المعماري:
//   select(*) ≈ 10.4KB/row = 565MB/fetch مقابل projection مينيمال ≈ 11.4MB.
//
// الحل هنا:
//   · Keyset pagination صارم: WHERE stock_status AND id < lastId ORDER BY id DESC
//     LIMIT 5000 — صفر OFFSET أبداً (54,367 صف).
//   · توليد XML في SQL نفسه (string_agg) — الـ worker كيدير pass-through فقط
//     (CPU متكلف في Workers — الأعمدة تتجمع في Postgres).
//   · Projection مينيمال حرفياً: id · title · description (GMC إجباري) · price ·
//     image · category — ≈ 210B/row → ~11.4MB قراءة بدل 565MB (فارق ×50).
//   · رفع R2 multipart (أجزاء ≥5MiB) — الذاكرة محدودة (صفحة واحدة في الذاكرة).
//   · feeds/merchant-feed.xml (DZD كما هو) + feeds/merchant-feed-usd.xml
//     (تحويل حي عبر سعر الصرف من lib/fx).
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { openRoSql, type CronSql } from './cron-db';
import { getUsdPerDzdRate } from './fx';
import type { KvLike } from './kv-store';

const PAGE = 5000;
const PART_TARGET_BYTES = 8 * 1024 * 1024; // ≥ 5MiB إجباري uploadPart — نستهدف 8MiB
const SITE = 'https://laclarc.com';
const FEED_DZD_KEY = 'feeds/merchant-feed.xml';
const FEED_USD_KEY = 'feeds/merchant-feed-usd.xml';

export interface FeedResult {
  ok: boolean;
  file: string;
  items: number;
  bytes: number;
  ms: number;
  skipped?: 'no_rate' | 'no_db' | 'no_bucket';
}

export interface FeedsResult {
  ok: boolean;
  dzd: FeedResult;
  usd: FeedResult;
  rate: number | null;
  totalMs: number;
}

// ─── XML escape — سلسلة replace داخل SQL (كتبنى في Postgres — بلا دالة خارجية) ───
function sqlEsc(colExpr: string): string {
  return `replace(replace(replace(${colExpr}, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')`;
}

// ─── الصفحة الواحدة — كل توليد XML في Postgres ───
function pageSql(currency: 'DZD' | 'USD'): { sql: string; usesRate: boolean } {
  const priceExpr =
    currency === 'DZD'
      ? `round(price, 2)::text || ' DZD'`
      : `round(price / $1::numeric, 2)::text || ' USD'`;
  const sql = `
    WITH page AS (
      SELECT id, title,
             COALESCE(NULLIF(description, ''), title) AS description,
             price,
             COALESCE(NULLIF(image_url, ''), images[1], '${SITE}/placeholder.jpg') AS image_link,
             COALESCE(NULLIF(category, ''), 'other') AS category
      FROM products
      WHERE stock_status = true AND ($${currency === 'USD' ? 2 : 1}::bigint IS NULL OR id < $${currency === 'USD' ? 2 : 1}::bigint)
      ORDER BY id DESC
      LIMIT ${PAGE}
    )
    SELECT COALESCE(MAX(id), 0) AS last_id, COUNT(*)::int AS n,
      COALESCE(string_agg(
        '<item>' ||
        '<g:id>' || id || '</g:id>' ||
        '<title>' || ${sqlEsc("COALESCE(left(title, 150), '')")} || '</title>' ||
        '<description>' || ${sqlEsc('description')} || '</description>' ||
        '<link>' || '${SITE}/products/' || id || '</link>' ||
        '<g:image_link>' || ${sqlEsc('image_link')} || '</g:image_link>' ||
        '<g:price>' || ${priceExpr} || '</g:price>' ||
        '<g:condition>new</g:condition>' ||
        '<g:availability>in stock</g:availability>' ||
        '<g:product_type>' || ${sqlEsc('category')} || '</g:product_type>' ||
        '<g:item_group_id>' || id || '</g:item_group_id>' ||
        '</item>'
      , chr(10) ORDER BY id DESC), '') AS items_xml
    FROM page`;
  return { sql, usesRate: currency === 'USD' };
}

function buildHeader(currency: 'DZD' | 'USD'): string {
  const currencyNote =
    currency === 'DZD'
      ? 'Prices in Algerian Dinar (DZD)'
      : 'Prices converted from DZD to USD with live exchange rate';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    `<title>Laclarc — Google Merchant Feed (${currency})</title>`,
    `<link>${SITE}</link>`,
    '<description>Laclarc product catalog feed for Google Merchant Center</description>',
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `<!-- ${currencyNote} -->`,
  ].join('\n');
}

const FOOTER = '\n</channel>\n</rss>\n';

// ─── المولد الرئيسي ───
async function runFeedBuild(
  env: CfCronEnv,
  currency: 'DZD' | 'USD',
  lastIdStart: number,
  rate: number | null,
): Promise<FeedResult> {
  const started = Date.now();
  const file = currency === 'DZD' ? FEED_DZD_KEY : FEED_USD_KEY;
  const base: FeedResult = { ok: false, file, items: 0, bytes: 0, ms: 0 };

  const bucket = env.MEDIA_BUCKET as R2BucketLike | undefined;
  if (!bucket || typeof bucket.createMultipartUpload !== 'function') {
    console.warn('[feed] MEDIA_BUCKET missing');
    return { ...base, ms: Date.now() - started, skipped: 'no_bucket' };
  }
  if (currency === 'USD' && !rate) {
    console.warn('[feed] USD feed skipped — no exchange rate');
    return { ...base, ms: Date.now() - started, skipped: 'no_rate' };
  }

  const sql: CronSql | null = await openRoSql(env);
  if (!sql) {
    return { ...base, ms: Date.now() - started, skipped: 'no_db' };
  }

  try {
    const { sql: pageQuery } = pageSql(currency);
    const header = buildHeader(currency);
    const httpMetadata = {
      contentType: 'application/xml; charset=utf-8',
      cacheControl: 'public, max-age=21600',
    };
    const customMetadata = {
      generated_at: new Date().toISOString(),
      currency,
      source: 'laclarc-worker-cron',
    };

    // R2 multipart مباشر (بلا class — تدفق واضح وصفر إعادة بناء)
    const mp = await bucket.createMultipartUpload(file, {
      httpMetadata,
      customMetadata,
    });
    const parts: R2UploadedPartLike[] = [];
    let bufBytes = 0;
    let bufParts: Uint8Array[] = [];
    let partNo = 1;
    let items = 0;
    let bytes = 0;
    let lastId = lastIdStart;

    const pushChunk = async (chunk: string): Promise<void> => {
      const b = new TextEncoder().encode(chunk);
      bufParts.push(b);
      bufBytes += b.byteLength;
      bytes += b.byteLength;
      if (bufBytes >= PART_TARGET_BYTES) {
        const joined = new Uint8Array(bufBytes);
        let off = 0;
        for (const x of bufParts) {
          joined.set(x, off);
          off += x.byteLength;
        }
        bufParts = [];
        bufBytes = 0;
        const part = await mp.uploadPart(partNo, joined);
        parts.push({ partNumber: part.partNumber, etag: part.etag });
        partNo++;
      }
    };

    await pushChunk(header);

    for (;;) {
      const params =
        currency === 'USD' ? [rate as number, lastId] : [lastId];
      const rows = await sql.unsafe(pageQuery, params);
      const row = rows[0];
      if (!row || !row.items_xml || Number(row.n) === 0) break;
      await pushChunk(String(row.items_xml));
      await pushChunk('\n');
      items += Number(row.n);
      const maxId = Number(row.last_id);
      if (!Number.isFinite(maxId) || maxId <= 0 || Number(row.n) < PAGE) break;
      lastId = maxId;
    }

    await pushChunk(FOOTER);

    if (bufBytes > 0) {
      const joined = new Uint8Array(bufBytes);
      let off = 0;
      for (const x of bufParts) {
        joined.set(x, off);
        off += x.byteLength;
      }
      const part = await mp.uploadPart(partNo, joined);
      parts.push({ partNumber: part.partNumber, etag: part.etag });
    }

    await mp.complete(parts);
    const ms = Date.now() - started;
    console.log(`[feed] ${currency} done — items=${items} bytes=${bytes} ms=${ms} parts=${parts.length}`);
    return { ok: true, file, items, bytes, ms };
  } catch (e) {
    console.warn(`[feed] ${currency} failed:`,
      e instanceof Error ? e.message : e);
    return { ...base, ms: Date.now() - started };
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}

/**
 * بناء كلا الـ feeds ورفعهما إلى MEDIA_BUCKET.
 * kvOverride: للكرون (env مباشر) — نمرر NEXT_INC_CACHE_KV/STORE_KV لـ fx.
 */
export async function buildAllFeeds(env: CfCronEnv): Promise<FeedsResult> {
  const t0 = Date.now();
  const kv: KvLike | null =
    (env.STORE_KV as KvLike | undefined) ||
    (env.NEXT_INC_CACHE_KV as KvLike | undefined) ||
    null;

  // سعر الصرف أولاً (كيتخزن في KV — نفس المفتاح اللي كيستعمله المسار في fetch)
  const fx = await getUsdPerDzdRate(kv);
  const rate = fx?.dzdPerUsd ?? null;
  if (rate) console.log(`[feed] FX DZD/USD = ${rate}`);

  const dzd = await runFeedBuild(env, 'DZD', Number.MAX_SAFE_INTEGER, null);
  const usd = await runFeedBuild(env, 'USD', Number.MAX_SAFE_INTEGER, rate);

  const totalMs = Date.now() - t0;
  const result: FeedsResult = { ok: dzd.ok, dzd, usd, rate, totalMs };
  // بيانات آخر بناء في KV — للمراقبة (البند 5)
  try {
    if (kv && typeof kv.put === 'function') {
      await kv.put(
        'feeds:last_build',
        JSON.stringify({ at: Date.now(), dzd: dzd.items, usd: usd.items, bytes: dzd.bytes + usd.bytes, totalMs }),
      );
    }
  } catch { /* fail-open */ }
  return result;
}
