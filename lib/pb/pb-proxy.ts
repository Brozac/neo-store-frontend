// lib/pb/pb-proxy.ts — Phase B: الطبقة الأولى — proxy نحو الباك الأصلي
// ═══════════════════════════════════════════════════════════════════════
// القاعدة (تقرير Phase B): كل الـ routes كيبدأو بالـ proxy — الزائر كيخذو
// نفس السلوك حرفياً ملي Render حي. الـ fallback الأصلي كيجي غير عند:
//   خطأ شبكة / timeout / 5xx / صفحة HTML (Render down page).
// الـ 4xx شرعية (400/401/403/404/429) كيتشيرو كما هم — ماشي سبب fallback.
//
// ⚠️ البودي كيتقرا مرة وحدة فالـ route (rawBody) وكيتعدا هنا — قراءة
//   request مرتين في App Router كترجع فراغ (الـ stream كيتستهلك).
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authenticate', 'proxy-authorization', 'te', 'trailers',
  'host', 'content-length',
]);

export function pbBackendBase(): string {
  // 🩹 Phase G closure (2026-11-22): Render معلّق دائماً [user,billing] — قرار
  // المالك BACKEND CLOSED نهائياً. الـ proxy معطّل افتراضياً ('' = null فوري
  // → كل route كيمشي نيشان للـ fallback المحلي الحي — صفر hops ميتة).
  // القدرة باقية: PB_BACKEND_URL صريح غير فارغ = إعادة تشغيل proxy لمستقبل.
  // ممنوع default على NEXT_PUBLIC_API_URL/api.laclarc.com — worker route
  // api.laclarc.com/* كيخلي الـ proxy يطلب نفسو = حلقة لا نهائية.
  return process.env.PB_BACKEND_URL || '';
}

function filterHeaders(req: Request): Headers {
  const h = new Headers();
  req.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) h.set(k, v);
  });
  return h;
}

/**
 * proxy الطلب للباك — null إلا فشل (شبكة/timeout/5xx/HTML) → fallback أصلي.
 * Response سليم (2xx ولا 4xx شرعية) → يرجع كما هو.
 * @param rawBody بودي الطلب كنص (من request.text() — مقروء مرة وحدة فالـ route)
 */
export async function pbProxy(
  request: Request,
  backendPath: string,
  rawBody?: string,
  timeoutMs?: number,
): Promise<Response | null> {
  // 🩹 F110 loop-guard: طلب داج من الـ proxy بوحدو → ماتعاودش تبروكسيه
  // (حتى إلا تبدل الـ backend host لشي host مغطي بنفس الـ worker route)
  // 🩹 Phase G: بلا backend مضبوط = معطل نيشان (صفر hops ميتة)
  if (request.headers.get('x-pb-proxy')) return null;
  if (!pbBackendBase()) return null;
  try {
    const url = pbBackendBase() + backendPath;
    const method = request.method.toUpperCase();
    // 🩹 F110 timeout تكيفي: GET catalog = fail-fast 4s (fallback Hyperdrive)
    //    الكتابات (checkout/auth) = 10s — Render خاصو وقت كامل
    const t = timeoutMs ?? (method === 'GET' || method === 'HEAD' ? 4000 : 10000);
    const headers = filterHeaders(request);
    // علامة الطريق — الطرف الآخر (ولا حلقة محتملة) يعرف بلي هادا proxied
    headers.set('x-pb-proxy', '1');
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(t),
    };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = rawBody ?? '';
    }
    const res = await fetch(url, init);
    const ct = res.headers.get('content-type') || '';
    // صفحة HTML (Render error page) → fallback
    if (ct.includes('text/html')) return null;
    if (res.status >= 500) return null;
    return res;
  } catch {
    return null;
  }
}
