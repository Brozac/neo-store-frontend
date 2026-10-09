'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

export interface CheckoutItem {
  id: string | number;
  title: string;
  price: number;
  image_url?: string;
  quantity: number;
  vid?: string | null;
}

export interface CreateCheckoutOpts {
  token?: string | null;
  wheelDiscount?: number;       // 🎡 خصم SpinWheel — يسكن مع سطر الطلب (Tenet: الخصم مع السلة)
  utm?: Record<string, any>;    // 📊 attribution — UtmTracker → CAPI/Meta/TikTok
}

/**
 * Stripe checkout session — THE single writer (المسار الملك الوحيد).
 * Throws honest masked errors. On success caller MUST redirect and
 * MUST NOT re-enable any button (no finally after redirect).
 * v1.1: wheelDiscount + utm — الحقول المالية من checkout/page (لا خصم ضايع، لا attribution ضايع)
 */
export async function createCheckoutSession(
  items: CheckoutItem[],
  opts: CreateCheckoutOpts = {}
): Promise<string> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items,
      origin: window.location.origin,
      ...(opts.wheelDiscount ? { wheelDiscount: opts.wheelDiscount } : {}),
      ...(opts.utm ? { utm: opts.utm } : {}),
    }),
  });

  // 🛡️ HTML-error-page guard (Render 502 etc.) — res.json() alone crashes on '<'
  const raw = await res.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error page */ }

  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  if (!data.url) throw new Error('No checkout URL returned.');
  return data.url as string;
}