// ═══════════════════════════════════════════════════════════════
// Phase H — Edge Cache (Cache API) لقراءات الكاطالوگ العامة
// ═══════════════════════════════════════════════════════════════
// العقد: الـ Cache-Control الموجود أصلاً فالروت هو مصدر الحقيقة الوحيد.
// - Response فيه s-maxage → يتكاشا على حافة CF (caches.default) بنفس TTL
// - بلا s-maxage (search · count · by-ids) → كيمر ديناميكي كما كان
// - fail-open: أي خطأ فالكاش = الرد يرجع عادي بلا كاش — الطبقة ما تقدرش تكسر شي
// - ما كتلمسش auth/checkout/admin/payment — قراءات الكاطالوگ العامة فقط
// والـ HIT كيبان فالهيدر x-edge-cache باش القياس يكون بالعين.
export const EDGE_CACHE_HEADER = 'x-edge-cache';

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
  } catch { /* fail-open */ }

  // 2) MISS — تنفيذ فعلي + تخزين شرطي (200 + s-maxage + بلا no-store/private)
  const res = await handler();
  try {
    const cc = res.headers.get('Cache-Control') ?? '';
    if (
      res.status === 200 &&
      /s-maxage\s*=/i.test(cc) &&
      !/(no-store|private)/i.test(cc)
    ) {
      const toPut = res.clone();
      try { toPut.headers.set(EDGE_CACHE_HEADER, 'MISS'); } catch { /* cosmetic */ }
      await cache.put(cacheKey, toPut);
      try { res.headers.set(EDGE_CACHE_HEADER, 'MISS'); } catch { /* cosmetic */ }
    }
  } catch { /* fail-open — الرد الأصلي يرجع حتى إلا فشل التخزين */ }
  return res;
}
