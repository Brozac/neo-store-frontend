// lib/merchant-feed-r2.ts — phase-abc: توليد merchant feeds ورفعها إلى R2 (البند 6)
// ═══════════════════════════════════════════════════════════════════════
// الحقيقة الحية (audit 2026-11-23): الـ merchant feed ميت 404 في كل العناوين
//   (api/laclarc/rpc/usd) — قناة Google Shopping واقفة. السبب المعماري:
//   select(*) ≈ 10.4KB/row = 565MB/fetch مقابل projection مينيمال + XML فـ SQL.
//
// 🚨 ops-fix (2026-11-25) — الجذر الحقيقي توصلنا بيه بعد forensics:
//   1) 🐛 KEYSET OVERLAP BUG (القاتل الأساسي): الـ loop كان كياخذ MAX(id) تاع الصفحة
//      كـ continuation key مع فلتر id < MAX → كل صفحة جديدة كتعاود 4999 من 5000 صف
//      (99.98% overlap) → 54,235 صفحة بدل 11 → ساعات ديال القراءة → القتل المضمون
//      فـ 15 دقيقة (exceededWallTime — السقف الصلب ديال scheduled handler، ما كيتconfigاش).
//      دليل: Workers Logs 03:00:05 [feed] FX logged → 03:15:04 exceededWallTime،
//      والقياس الحي: advance=1 id/صفحة (97928→97927→97926) بدل ~5000.
//      الإصلاح: continuation = MIN(id) تاع الصفحة → advance كامل ~5000/صفحة → 11 صفحات.
//   2) exceededCpu (2026-11-24 03:00) — سقف CPU الافتراضي 30s — fix: limits.cpu_ms=300000.
//   3) تحصين: القراءة عبر openRwSql (المسار المباشر المثبت فنفس كونتكس cron — sweeper
//      1-2s كل ساعة) + fallback openRoSql/Hyperdrive؛ pass وحدة على الصفحات (USD كيتحوّل
//      من نفس الـ chunk فالـ worker — نص egress ديال Supabase ~120MB بدل ~240MB يومياً)؛
//      progress log لكل صفحة؛ FEEDS_DONE/FEEDS_ERROR فـ system_events؛ ميزانية wall 11min
//      + abort ديال multipart عند الفشل — الـ feeds القديمة كتبقى سليمة.
// ═══════════════════════════════════════════════════════════════════════
import { openRoSql, openRwSql, logSystemEvent, type CronSql } from './cron-db';
import { getUsdPerDzdRate } from './fx';
import type { KvLike } from './kv-store';

const PAGE = 5000;
const PART_TARGET_BYTES = 8 * 1024 * 1024; // ≥ 5MiB إجباري uploadPart — نستهدف 8MiB
const SITE = 'https://laclarc.com';
const FEED_DZD_KEY = 'feeds/merchant-feed.xml';
const FEED_USD_KEY = 'feeds/merchant-feed-usd.xml';
// درس exceededWallTime: السقف الصلب ديال scheduled handler هو 15:00 — من بعد
// 11 دقيقة كنوقفو وننصحّحو (abort) باش الـ feeds القديمة تبقى هي لي خدّامة.
const WALL_BUDGET_MS = 11 * 60 * 1000;

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

// ─── الصفحة الواحدة — كل توليد XML (DZD) في Postgres؛ USD كيتحوّل فالـ worker ───
// 🐛 FIX: continuation key هو MIN(id) تاع الصفحة (next_id) — ماشي MAX!
//   ORDER BY id DESC LIMIT 5000 → آخر صف فالصفحة هو الأصغر → id < MIN كيعطي
//   الصفحة الجاية بلا أي overlap (advance ≈ 5000 id/صفحة → 11 صفحات لـ 54k منتج).
function pageSql(): string {
  const sql = `
    WITH page AS (
      SELECT id, title,
             COALESCE(NULLIF(description, ''), title) AS description,
             price,
             COALESCE(NULLIF(image_url, ''), images[1], '${SITE}/placeholder.jpg') AS image_link,
             COALESCE(NULLIF(category, ''), 'other') AS category
      FROM products
      WHERE stock_status = true AND ($1::bigint IS NULL OR id < $1::bigint)
      ORDER BY id DESC
      LIMIT ${PAGE}
    )
    SELECT COALESCE(MIN(id), 0) AS next_id, COUNT(*)::int AS n,
      COALESCE(string_agg(
        '<item>' ||
        '<g:id>' || id || '</g:id>' ||
        '<title>' || ${sqlEsc("COALESCE(left(title, 150), '')")} || '</title>' ||
        '<description>' || ${sqlEsc('description')} || '</description>' ||
        '<link>' || '${SITE}/products/' || id || '</link>' ||
        '<g:image_link>' || ${sqlEsc('image_link')} || '</g:image_link>' ||
        '<g:price>' || round(price, 2)::text || ' DZD' || '</g:price>' ||
        '<g:condition>new</g:condition>' ||
        '<g:availability>in stock</g:availability>' ||
        '<g:product_type>' || ${sqlEsc('category')} || '</g:product_type>' ||
        '<g:item_group_id>' || id || '</g:item_group_id>' ||
        '</item>'
      , chr(10) ORDER BY id DESC), '') AS items_xml
    FROM page`;
  return sql;
}

// ─── التحويل DZD → USD داخل الـ worker ───
// آمن: '<' فالأوصاف/العناوين/الفئات مفرّغ فـ SQL (sqlEsc) → <g:price> كيبان
// غير فسطر الثمن. نفس rounding تاع round(price/rate, 2).
function usdItemsFromDzd(dzdXml: string, rate: number): string {
  return dzdXml.replace(/<g:price>(\d+(?:\.\d+)?) DZD<\/g:price>/g, (_m, p: string) => {
    const usd = Math.round((parseFloat(p) / rate) * 100) / 100;
    return `<g:price>${usd.toFixed(2)} USD</g:price>`;
  });
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

// ─── حالة رافع multipart واحد (buffer + progress) ───
interface UploadState {
  parts: R2UploadedPartLike[];
  bufParts: Uint8Array[];
  bufBytes: number;
  partNo: number;
  bytes: number;
}

function newUploadState(): UploadState {
  return { parts: [], bufParts: [], bufBytes: 0, partNo: 1, bytes: 0 };
}

async function pushChunk(
  mp: R2MultipartUploadLike,
  st: UploadState,
  chunk: string,
): Promise<void> {
  const b = new TextEncoder().encode(chunk);
  st.bufParts.push(b);
  st.bufBytes += b.byteLength;
  st.bytes += b.byteLength;
  if (st.bufBytes >= PART_TARGET_BYTES) {
    const joined = new Uint8Array(st.bufBytes);
    let off = 0;
    for (const x of st.bufParts) {
      joined.set(x, off);
      off += x.byteLength;
    }
    st.bufParts = [];
    st.bufBytes = 0;
    const part = await mp.uploadPart(st.partNo, joined);
    st.parts.push({ partNumber: part.partNumber, etag: part.etag });
    st.partNo++;
  }
}

async function flushTail(mp: R2MultipartUploadLike, st: UploadState): Promise<void> {
  if (st.bufBytes > 0) {
    const joined = new Uint8Array(st.bufBytes);
    let off = 0;
    for (const x of st.bufParts) {
      joined.set(x, off);
      off += x.byteLength;
    }
    st.bufParts = [];
    st.bufBytes = 0;
    const part = await mp.uploadPart(st.partNo, joined);
    st.parts.push({ partNumber: part.partNumber, etag: part.etag });
    st.partNo++;
  }
}

async function abortQuietly(mp: R2MultipartUploadLike | null): Promise<void> {
  if (!mp) return;
  try {
    await mp.abort();
  } catch {
    /* fail-open — الأجزاء اليتيمة كيتنظفو يدوياً إلا تلزم */
  }
}

/**
 * بناء كلا الـ feeds ورفعهما إلى MEDIA_BUCKET — pass وحدة على الصفحات.
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

  const base = (file: string): FeedResult => ({ ok: false, file, items: 0, bytes: 0, ms: 0 });
  const dzd: FeedResult = base(FEED_DZD_KEY);
  const usd: FeedResult = base(FEED_USD_KEY);
  const failBoth = (skipped: FeedResult['skipped']): FeedsResult => {
    dzd.skipped = dzd.skipped ?? skipped;
    usd.skipped = usd.skipped ?? skipped;
    dzd.ms = usd.ms = Date.now() - t0;
    return { ok: false, dzd, usd, rate, totalMs: Date.now() - t0 };
  };

  const bucket = env.MEDIA_BUCKET as R2BucketLike | undefined;
  if (!bucket || typeof bucket.createMultipartUpload !== 'function') {
    console.warn('[feed] MEDIA_BUCKET missing');
    return failBoth('no_bucket');
  }
  if (!rate) {
    console.warn('[feed] USD feed skipped — no exchange rate');
    usd.skipped = 'no_rate';
  }

  // 🩹 المسار المباشر (RW) أولاً — مثبت سريع فنفس كونتكس cron — Hyperdrive fallback
  const sql: CronSql | null = (await openRwSql(env)) || (await openRoSql(env));
  if (!sql) {
    console.warn('[feed] no SQL client (rw + ro missing) — build skipped');
    return failBoth('no_db');
  }

  let mpDzd: R2MultipartUploadLike | null = null;
  let mpUsd: R2MultipartUploadLike | null = null;
  let stDzd: UploadState = newUploadState();
  let stUsd: UploadState | null = null;
  let pages = 0;
  let buildError: string | null = null;

  try {
    const pageQuery = pageSql();
    const nowIso = new Date().toISOString();
    const httpMetadata = {
      contentType: 'application/xml; charset=utf-8',
      cacheControl: 'public, max-age=21600',
    };

    mpDzd = await bucket.createMultipartUpload(FEED_DZD_KEY, {
      httpMetadata,
      customMetadata: { generated_at: nowIso, currency: 'DZD', source: 'laclarc-worker-cron' },
    });
    await pushChunk(mpDzd, stDzd, buildHeader('DZD'));

    if (rate) {
      mpUsd = await bucket.createMultipartUpload(FEED_USD_KEY, {
        httpMetadata,
        customMetadata: { generated_at: nowIso, currency: 'USD', source: 'laclarc-worker-cron' },
      });
      stUsd = newUploadState();
      await pushChunk(mpUsd, stUsd, buildHeader('USD'));
    }

    let lastId = Number.MAX_SAFE_INTEGER;
    for (;;) {
      if (Date.now() - t0 > WALL_BUDGET_MS) {
        throw new Error(`wall_budget_exceeded_at_page_${pages}`);
      }
      const tq = Date.now();
      const rows = await sql.unsafe(pageQuery, [lastId]);
      const qMs = Date.now() - tq;
      const row = rows[0];
      if (!row || !row.items_xml || Number(row.n) === 0) break;
      const xml = String(row.items_xml);
      await pushChunk(mpDzd, stDzd, xml);
      await pushChunk(mpDzd, stDzd, '\n');
      dzd.items += Number(row.n);
      if (mpUsd && stUsd && rate) {
        await pushChunk(mpUsd, stUsd, usdItemsFromDzd(xml, rate));
        await pushChunk(mpUsd, stUsd, '\n');
        usd.items += Number(row.n);
      }
      pages++;
      console.log(
        `[feed] page ${pages} rows=${Number(row.n)} q_ms=${qMs} dzd_bytes=${stDzd.bytes} usd_bytes=${stUsd ? stUsd.bytes : 0} elapsed_ms=${Date.now() - t0}`,
      );
      // 🐛 FIX: continuation = MIN(id) تاع الصفحة (next_id) — id < MIN كيضمن صفر overlap
      const nextId = Number(row.next_id);
      if (!Number.isFinite(nextId) || nextId <= 0 || Number(row.n) < PAGE) break;
      lastId = nextId;
    }

    await pushChunk(mpDzd, stDzd, FOOTER);
    await flushTail(mpDzd, stDzd);
    await mpDzd.complete(stDzd.parts);
    dzd.ok = true;
    dzd.bytes = stDzd.bytes;
    console.log(`[feed] DZD done — items=${dzd.items} bytes=${dzd.bytes} parts=${stDzd.parts.length}`);

    if (mpUsd && stUsd) {
      await pushChunk(mpUsd, stUsd, FOOTER);
      await flushTail(mpUsd, stUsd);
      await mpUsd.complete(stUsd.parts);
      usd.ok = true;
      usd.bytes = stUsd.bytes;
      console.log(`[feed] USD done — items=${usd.items} bytes=${usd.bytes} parts=${stUsd.parts.length}`);
    }
  } catch (e) {
    buildError = e instanceof Error ? e.message : String(e);
    console.warn(`[feed] build failed after ${pages} pages:`, buildError);
    await abortQuietly(mpDzd);
    await abortQuietly(mpUsd);
    mpDzd = null;
    mpUsd = null;
  }

  // شاهد DB — FEEDS_DONE/FEEDS_ERROR فـ system_events (مثل SWEEPER_DONE/PRICE_SYNC_DONE)
  try {
    if (buildError) {
      await logSystemEvent(
        sql,
        'FEEDS_ERROR',
        { error: buildError.slice(0, 300), pages, dzd_items: dzd.items, usd_items: usd.items, ms: Date.now() - t0 },
        'error',
      );
    } else if (dzd.ok || usd.ok) {
      await logSystemEvent(
        sql,
        'FEEDS_DONE',
        {
          pages,
          dzd_items: dzd.items,
          dzd_bytes: dzd.bytes,
          usd_items: usd.items,
          usd_bytes: usd.bytes,
          rate,
          ms: Date.now() - t0,
        },
        'info',
      );
    }
  } catch {
    /* fail-open — اللوجات هي الشاهد الاحتياطي */
  }

  try {
    await sql.end({ timeout: 3 });
  } catch {
    /* backstop */
  }

  const totalMs = Date.now() - t0;
  dzd.ms = totalMs;
  usd.ms = totalMs;
  const result: FeedsResult = { ok: dzd.ok, dzd, usd, rate, totalMs };

  // بيانات آخر بناء في KV — للمراقبة (البند 5)
  try {
    if (kv && typeof kv.put === 'function') {
      await kv.put(
        'feeds:last_build',
        JSON.stringify({
          at: Date.now(),
          dzd: dzd.items,
          usd: usd.items,
          bytes: dzd.bytes + usd.bytes,
          totalMs,
        }),
      );
    }
  } catch {
    /* fail-open */
  }
  return result;
}
