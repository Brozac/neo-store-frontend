// ═══════════════════════════════════════════════════════════════════
// Phase H — Edge Cache (Cache API) لقراءات الكاطالوگ العامة
// ═══════════════════════════════════════════════════════════════════
// العقد: الـ Cache-Control الموجود أصلاً فالروت هو مصدر الحقيقة الوحيد.
// - Response فيه s-maxage → يتكاشا على حافة CF (caches.default) بنفس TTL
// - بلا s-maxage (search · count · by-ids) → كيمر ديناميكي كما كان
// - fail-open: أي خطأ فالكاش = الرد يرجع عادي بلا كاش — الطبقة ما تقدرش تكسر شي
// - ما كتلمسش auth/checkout/admin/payment — قراءات الكاطالوگ العامة فقط
// والـ HIT كيبان فالهيدر x-edge-cache باش القياس يكون بالعين.
//
// ─── Phase H v2 — نسخة الكاش (purge فوري عبر KV) ───
// مفاتيح Cache API كتضاف ليها ?__cv=<edgecache:catalog_version من KV>.
// bump التسجيل من /api/edge-cache-purge = مفاتيح جديدة فوراً → الطبقة
// الديال Worker كتفقى عند أول طلب بعد التعديل.
// v2.1 — الطبقتين مفصولات: zone cache (القدامية، cf-cache-status) تحمل
// s-maxage=15s soft — كل تعمير تاعها كيدوز من بوابة النسخة (مقاوم للـ
// resurrection: الرد القديم ما يمكنش يعمر الـ zone بعد انتشار KV).
// الطبقة ديال Worker كتخزن بـ max-age=TTL الأصلي (60-3600s) = حماية DB.
// fail-open: KV ما جابش = نسخة '' = مفاتيح بلا __cv = نفس سلوك H.1.
import { revalidateTag } from 'next/cache';

export const EDGE_CACHE_HEADER = 'x-edge-cache';

// نسخة الكاش — KV نفسو تاع ISR (NEXT_INC_CACHE_KV) بمفتاح مسمّى خاص.
const VERSION_KV_KEY = 'edgecache:catalog_version';
const VERSION_MICROCACHE_MS = 5_000;
// قراءة KV وحدة كل 5s لكل isolate (كوتا KV: 100k قراءة/يوم)
let versionCache: { v: string; at: number } = { v: '', at: 0 };
// v2.1 — TTL "soft" تاع zone cache (الطبقة القدامية): النسخة كتجدد عبر الـ Worker
// كل 15s — بعد التعديل الطبقة القدامية كتفقى ف≤15s+انتشار KV بدل 2-10 دقائق.
const ZONE_SOFT_TTL_S = 15;

async function getCatalogVersion(): Promise<string> {
  const now = Date.now();
  if (now - versionCache.at < VERSION_MICROCACHE_MS) return versionCache.v;
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const kv = env?.NEXT_INC_CACHE_KV as
      | { get?: (key: string) => Promise<string | null> }
      | undefined;
    const v = kv && typeof kv.get === 'function' ? await kv.get(VERSION_KV_KEY) : null;
    versionCache = { v: typeof v === 'string' ? v.slice(0, 64) : '', at: now };
  } catch {
    // بلا context (build محلي / wrangler dev بلا binding) — fail-open
    versionCache = { v: '', at: now };
  }
  return versionCache.v;
}

type CacheStoreLike = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, res: Response): Promise<void>;
};

function edgeCache(): CacheStoreLike | null {
  try {
    const c = (globalThis as { caches?: { default?: CacheStoreLike } }).caches;
    return c?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * كيغلف GET handler تاع روت كاطالوگ: يبني المفتاح من الـ URL الكامل
 * (path+query — كل page/search مختلف = مفتاح مختلف)، يجرب match، وإلا
 * ينفذ الـ handler ويخزن الرد إلا كان 200 مع s-maxage.
 */
export async function withEdgeCache(
  req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const cache = edgeCache();
  if (!cache || req.method !== 'GET') return handler();

  let cacheKey: Request;
  try {
    const url = new URL(req.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return handler();
    // v2 — المفتاح كيشمل نسخة الكاش: bump الـ KV = مفاتيح جديدة فوراً
    const ver = await getCatalogVersion();
    if (ver) url.searchParams.set('__cv', ver);
    cacheKey = new Request(url.toString(), { method: 'GET' });
  } catch {
    return handler();
  }

  // 1) HIT — الرد المخزن يرجع كما هو مع علامة HIT
  try {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const out = hit.clone();
      try { out.headers.set(EDGE_CACHE_HEADER, 'HIT'); } catch { /* cosmetic */ }
      return out;
    }
  } catch (e) {
    console.warn('[edge-cache] match failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }

  // 2) MISS — تنفيذ فعلي + تخزين شرطي (200 + s-maxage + بلا no-store/private)
  const res = await handler();
  try {
    const cc = res.headers.get('Cache-Control') ?? '';
    const smax = cc.match(/s-maxage\s*=\s*(\d+)/i);
    if (
      res.status === 200 &&
      smax &&
      !/(no-store|private)/i.test(cc) &&
      !res.headers.has('Set-Cookie')
    ) {
      // 🔑 المفتاح: Vary تاع Next (rsc/next-router-*) كيمنع التكاش فمكانين —
      // zone cache (cache.enabled) و Cache API. لروتات JSON تاع الكاطالوگ
      // الـ RSC ما يعنيش والو → الحذف سليم دلالياً. من بعد، zone cache
      // كيكاشي الرد بوحدو (s-maxage حاضر) وكيخدم قبل الـ Worker عند HIT.
      res.headers.delete('Vary');
      const ttl = parseInt(smax[1], 10); // TTL الحقيقي — للطبقة ديال Worker
      const body = await res.clone().text(); // جسم مقيد — بلا streams فالكاش
      const putHeaders = new Headers(res.headers);
      putHeaders.set('Cache-Control', `public, max-age=${ttl}`);
      putHeaders.delete('Vary');
      putHeaders.delete('Set-Cookie');
      const putRes = new Response(body, { status: 200, headers: putHeaders });
      await cache.put(cacheKey, putRes);
      try { res.headers.set(EDGE_CACHE_HEADER, 'MISS'); } catch { /* cosmetic */ }
      // 🔑 v2.1 — الطبقات مفصولة:
      //   zone cache (قدام) ← s-maxage=15s "soft" فقط — كل 15s الـ zone كتنقضي
      //   وكتعاود تعمّر عبر الـ Worker → كل تعمير كيدوز من بوابة __cv (نسخة KV)
      //   = مقاوم للـ "resurrection" (الرد القديم ما يمكنش يعمر الـ zone من بعد
      //   ما النسخة الجديدة توصل للـ PoP). الأثر على الكوتا: عند HIT الـ Worker
      //   ما كيتنفذش بزال — الاستدعاءات الزايدة = تعمير وحدة كل 15s لكل PoP.
      //   الطبقة ديال Worker (تحت) ← max-age=ttl الأصلي (60-3600s) — كيحمي الـ DB.
      //   النتيجة بعد التعديل: فوري فمنطقة الأدمن، ≤~75s عالمياً (انتشار KV
      //   ≤60s + window الـ zone) بدل 2-10 دقائق.
      try {
        res.headers.set('Cache-Control', `public, s-maxage=${ZONE_SOFT_TTL_S}`);
      } catch { /* cosmetic */ }
    } else if (res.status === 200) {
      // 🔒 بلا s-maxage = محتوى ديناميكي (search · count · by-ids) — منع صريح:
      // workers zone cache كيكاشي الردود اللي بلا Cache-Control بنفسو!
      try { res.headers.set('Cache-Control', 'no-store'); } catch { /* cosmetic */ }
    }
  } catch (e) {
    console.warn('[edge-cache] put failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
  return res;
}

// ═══════════════════════════════════════════════════════════════════
// 🆕 100% D1 — purgeEdgeCache — purge موحّد بعد كل كتابة كاتالوگ
// ═══════════════════════════════════════════════════════════════════
// المنادي: /api/admin/d1-realtime-sync (الكتابة الحية من PostgreSQL المحلي)
// — وphase-2 من بعد. ثلاث طبقات، كل وحدة fail-open بوحدها:
//   a) revalidateTag — دايماً (tag cache على D1 — رخيصة، بلا كوتا KV)
//      → صفحة المنتج (ISR) كتعاود تتولد عند أول طلب.
//   b) zone purge بالـ URLs الدقيقة (debounce 3s/isolate) — API المنتج +
//      صفحة المنتج على الطبقة القدامية → freshness ~ثواني بعد التعديل.
//   c) bump نسخة الكاش فالـ KV (debounce 25s/isolate) — كل مفاتيح
//      القوائم/الرئيسية/الفئات كتبدل (نفس بوابة edge-cache-purge) —
//      الـ debounce حماية لكوتا KV (1000 كتابة/يوم مجاناً) قدام bulk sync.
// ═══════════════════════════════════════════════════════════════════
// معرف غير سري (كيبان فكل نداء CF API) — zone laclarc.com
const CF_ZONE_ID_PURGE = '234ef6b0c01d0cb85553852a4d0b79a3';
const PURGE_ORIGINS = ['https://laclarc.com', 'https://www.laclarc.com'];
const ZONE_PURGE_MIN_MS = 3_000;
const KV_BUMP_MIN_MS = 25_000;
let lastZonePurgeAt = 0;
let lastKvBumpAt = 0;

async function bumpCatalogVersion(): Promise<boolean> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const kv = env?.NEXT_INC_CACHE_KV as
      | { put?: (key: string, value: string) => Promise<void> }
      | undefined;
    if (!kv || typeof kv.put !== 'function') return false;
    await kv.put(VERSION_KV_KEY, `v${Date.now().toString(36)}`);
    return true;
  } catch {
    return false; // fail-open — TTL هو شبكة الأمان
  }
}

async function purgeZoneUrls(urls: string[]): Promise<number> {
  const token = (process.env.EDGE_PURGE_API_TOKEN || '').trim();
  const files = urls.slice(0, 30); // حد CF API: 30 URL/نداء
  if (!token || files.length === 0) return 0;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID_PURGE}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    const j = (await r.json().catch(() => null)) as { success?: boolean } | null;
    return j?.success === true ? files.length : 0;
  } catch {
    return 0; // fail-open
  }
}

/**
 * purge بعد كتابة منتج/منتجات. كيرجع تقرير صغير للـ endpoint باش يتسجل.
 * الإنتروبيا: id واحد كيغطي /api/products/{id} + /products/{id} على الأصول
 * الاثنين + tags تاع ISR + نسخة القوائم (الرئيسية/الفئات/الصفحات).
 */
export async function purgeEdgeCache(
  productIds: number[] = [],
): Promise<{ tags: string[]; purged: number; bumped: boolean; ms: number }> {
  const t0 = Date.now();
  const ids = productIds
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 2147483647)
    .slice(0, 7);

  // (a) revalidateTag — دايماً (رخيصة — tag cache على D1)
  const tags: string[] = [];
  for (const id of ids) {
    tags.push(`product-${id}`);
    try { revalidateTag(`product-${id}`, 'max'); } catch { /* ISR اختياري */ }
  }
  try { revalidateTag('products-index', 'max'); } catch { /* ISR اختياري */ }

  // (b) zone purge دقيقة — debounce 3s (القوائم الكبيرة كيتغطاها الـ KV bump)
  let purged = 0;
  const now = Date.now();
  if (ids.length && now - lastZonePurgeAt >= ZONE_PURGE_MIN_MS) {
    lastZonePurgeAt = now;
    const files: string[] = [];
    for (const id of ids) {
      for (const o of PURGE_ORIGINS) {
        files.push(`${o}/api/products/${id}`, `${o}/products/${id}`);
      }
    }
    purged = await purgeZoneUrls([...new Set(files)].slice(0, 30));
  }

  // (c) bump نسخة الكاش — debounce 25s (حماية كوتا KV قدام bulk sync)
  let bumped = false;
  if (Date.now() - lastKvBumpAt >= KV_BUMP_MIN_MS) {
    lastKvBumpAt = Date.now();
    bumped = await bumpCatalogVersion();
  }

  return { tags, purged, bumped, ms: Date.now() - t0 };
}
