// lib/pb/pb-stripe.ts — Phase B: Stripe REST مباشر عبر fetch (بلا SDK)
// ═══════════════════════════════════════════════════════════════════════
// 🩹 الدرس المثبت (تقرير Phase B — إصلاح #3): بناء URL يدوياً — normalization
//   دالة stripeApi كانت كتقبل 'checkout/sessions' بلا '/' → Invalid URL.
// الـ encoder مربوط حرفياً مع اللي كيصيفطه الباك (nested form params).
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';

export function stripeApi(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `https://api.stripe.com/v1/${clean}`;
}

/** form-encoding للمعاملات المتداخلة — مطابق لما كيصيفطو stripe-node */
export function encodeStripeParams(data: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          out.push(...encodeStripeParams(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === 'object') {
      out.push(...encodeStripeParams(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function stripeRequest(
  secret: string,
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const url = method === 'GET' && params
    ? `${stripeApi(path)}?${encodeStripeParams(params).join('&')}`
    : stripeApi(path);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' && params ? encodeStripeParams(params).join('&') : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let json: Record<string, unknown> = {};
  try { json = await res.json() as Record<string, unknown>; } catch { /* error page */ }
  return { ok: res.ok, status: res.status, json };
}

export async function stripeCreateCheckoutSession(
  secret: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await stripeRequest(secret, 'POST', 'checkout/sessions', params);
  return { ok: r.ok, status: r.status, json: r.json };
}

export async function stripeRetrieveCheckoutSession(
  secret: string,
  sessionId: string,
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  // session_id كيتحقق من قبل — GET مباشر بلا params
  const r = await stripeRequest(secret, 'GET', `checkout/sessions/${encodeURIComponent(sessionId)}`);
  return { ok: r.ok, json: r.json };
}

export async function stripeCreateCoupon(
  secret: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string }> {
  const r = await stripeRequest(secret, 'POST', 'coupons', data);
  if (r.ok && typeof r.json.id === 'string') return { ok: true, id: r.json.id };
  return { ok: false };
}
