// ═══════════════════════════════════════════════════════════════
// Phase H — Edge Cache (Cache API) لقراءات الكاطالوگ العامة
// ═══════════════════════════════════════════════════════════════
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
// الديال Worker كتفقى عند أول طلب بعد التعديل (≤5s micro-cache + انتشار
// KV ≤60s عالمياً). الطبقة اللي قدام (zone cache، cf-cache-status) كتبقى
// كما هي — الـ purge تاعها بالـ URLs الدقيقة عبر CF API من روت الـ purge.
// fail-open: KV ما جابش = نسخة '' = مفاتيح بلا __cv = نفس سلوك H.1.
export const EDGE_CACHE_HEADER = 'x-edge-cache';

// نسخة الكاش — KV نفسو تاع ISR (NEXT_INC_CACHE_KV) بمفتاح مسمّى خاص.
const VERSION_KV_KEY = 'edgecache:catalog_version';
const VERSION_MICROCACHE_MS = 5_000;
// micro-cache فالـ isolate — قراءة KV وحدة كل 5s لكل isolate (كوتا KV: 100k قراءة/يوم)
let versionCache: { v: string; at: number } = { v: '', at: 0 };

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
      // workerd Cache API كيتجاهل s-maxage وحدو — نسخة التخزين تحصل على
      // max-age مكافئ (طبقة ثانية واطية تحت الـ zone cache)
      const ttl = parseInt(smax[1], 10);
      const body = await res.clone().text(); // جسم مقيد — بلا streams فالكاش
      const putHeaders = new Headers(res.headers);
      putHeaders.set('Cache-Control', `public, max-age=${ttl}`);
      putHeaders.delete('Vary');
      putHeaders.delete('Set-Cookie');
      const putRes = new Response(body, { status: 200, headers: putHeaders });
      await cache.put(cacheKey, putRes);
      try { res.headers.set(EDGE_CACHE_HEADER, 'MISS'); } catch { /* cosmetic */ }
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
