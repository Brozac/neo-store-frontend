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
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.laclarc.com';
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
  timeoutMs = 8000,
): Promise<Response | null> {
  try {
    const url = pbBackendBase() + backendPath;
    const method = request.method.toUpperCase();
    const init: RequestInit = {
      method,
      headers: filterHeaders(request),
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = rawBody ?? '';
      if (rawBody !== undefined) {
        // content-length الأصلي كيتحيّد — الـ fetch كيحسبه من الـ body الجديد
        init.headers = filterHeaders(request);
      }
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
