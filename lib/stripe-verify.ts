// lib/stripe-verify.ts — phase-abc: تحقق توقيع Stripe بـ Web Crypto (البند 7a)
// ═══════════════════════════════════════════════════════════════════════
// نفس الحساب اللي كيدير stripe.webhooks.constructEventAsync — بلا SDK:
//   header: Stripe-Signature: t=<ts>,v1=<hex>,v1=<hex>...
//   signed_payload = `${t}.${rawBody}`
//   expected = HMAC-SHA256(STRIPE_WEBHOOK_SECRET, signed_payload) hex
//   مقارنة time-safe على كل v1 + تسامح الوقت ±tolerance (default 300s)
// مكافئة سلوكياً للـ SDK (نفس الضمانات) — والريبو كيخدم بلا SDK Stripe أصلاً
// (pb-stripe.ts = REST مباشر) — اتجاه واحد متسق.
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';

const SCHEME_V1 = 'v1';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** مقارنة ثابتة الوقت — كتسري كل البايتات حتى مع فروق مبكرة */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface StripeSigResult {
  ok: boolean;
  reason?: 'missing_header' | 'bad_header' | 'bad_timestamp' | 'signature_mismatch';
  /** العمر التوقيع بالثواني — للتشخيص */
  ageSeconds?: number;
}

export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<StripeSigResult> {
  if (!sigHeader || !sigHeader.trim()) return { ok: false, reason: 'missing_header' };

  const parts = sigHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') timestamp = value;
    else if (key === SCHEME_V1) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return { ok: false, reason: 'bad_header' };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const nowSec = Math.floor(Date.now() / 1000);
  const age = nowSec - ts;
  if (age < -toleranceSeconds || age > toleranceSeconds) {
    return { ok: false, reason: 'bad_timestamp', ageSeconds: age };
  }

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(secret);
  const payloadBytes = encoder.encode(`${timestamp}.${rawBody}`);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, payloadBytes);
  const expected = new Uint8Array(mac);

  for (const sig of signatures) {
    try {
      if (timingSafeEqual(expected, hexToBytes(sig))) {
        return { ok: true, ageSeconds: age };
      }
    } catch {
      // hex تالف — نجرب المطابق التالي
    }
  }
  return { ok: false, reason: 'signature_mismatch', ageSeconds: age };
}
