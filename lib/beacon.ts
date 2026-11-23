// lib/beacon.ts — phase-abc: beacon الأناليتكس من الـ client (البند 9)
// ═══════════════════════════════════════════════════════════════════════
// client-safe (بلا server-only) — sendBeacon أولوية (ما كيحبسش navigation)
// مع fallback fetch keepalive. صفر انتظار، صفر استثناءات — fail-silent.
// ═══════════════════════════════════════════════════════════════════════

export type BeaconType = 'product_view' | 'add_to_cart' | 'checkout_start' | 'search' | 'utm_visit';

export interface BeaconFields {
  productId?: number;
  query?: string;
  path?: string;
  utm?: string;
}

export function sendAnalyticsBeacon(type: BeaconType, fields: BeaconFields = {}): void {
  try {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({
      type,
      ...(typeof fields.productId === 'number' ? { productId: fields.productId } : {}),
      ...(fields.query ? { query: fields.query.slice(0, 120) } : {}),
      ...(fields.path ? { path: fields.path.slice(0, 160) } : {}),
      ...(fields.utm ? { utm: fields.utm.slice(0, 120) } : {}),
    });
    const blob = new Blob([payload], { type: 'application/json' });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon('/api/analytics/collect', blob)) return;
    }
    // fallback — keepalive كيسمح بالكملة حتى بعد الخروج
    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fail-silent — الأناليتكس ما كيكسرش الواجهة أبداً
  }
}
