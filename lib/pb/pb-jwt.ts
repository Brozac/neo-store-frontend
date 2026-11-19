// lib/pb/pb-jwt.ts — Phase B: HS256 sign/verify via WebCrypto — نفس سر الباك
// ═══════════════════════════════════════════════════════════════════════
// 🩹 الدرس المثبت (تقرير Phase B — إصلاح #2): الـ base64url decode خاصو
//   يترجم '-'→'+' و'_'→'/' ويكمّل padding — أي اختصار كيحيّد أحرف شرعية
//   وكيفشل التواقيع عشوائياً.
// التوافق: jsonwebtoken (الباك) HS256 — payload ديال user (id/email/exp)
//   وwheel (type/pct/exp). التوقيع ديال Render كيتقبل كما هو.
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getPbRuntime, pbVar } from './pb-env';

function b64urlDecodeToString(s: string): string {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function b64urlEncodeBytes(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeString(s: string): string {
  return b64urlEncodeBytes(new TextEncoder().encode(s));
}

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

export interface PbJwtPayload {
  [k: string]: unknown;
  id?: number;
  email?: string;
  type?: string;
  pct?: number;
  exp?: number;
}

/** التحقق من التوكن — null إلا أي حاجة غالطة/منتهية */
export async function pbVerifyJwt(
  token: string,
  secret: string,
): Promise<PbJwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await hmacKey(secret, ['verify']);
    const sig = new Uint8Array(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (parts[2].length % 4)) % 4))
        .split('')
        .map((c) => c.charCodeAt(0)),
    );
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sig,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecodeToString(parts[1])) as PbJwtPayload;
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** توقيع wheel token — بدون iat (نفس الشكل الحي المصطاد من الإنتاج) */
export async function pbSignWheelJwt(
  pct: number,
  secret: string,
  ttlSeconds = 24 * 60 * 60,
): Promise<string> {
  const header = b64urlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlEncodeString(
    JSON.stringify({ type: 'wheel', pct, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  );
  const key = await hmacKey(secret, ['sign']);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64urlEncodeBytes(new Uint8Array(sig))}`;
}

/** سر JWT — من env (secret RW_DATABASE_URL style) ولا process.env */
export async function getPbJwtSecret(): Promise<string | undefined> {
  const { env } = await getPbRuntime();
  return pbVar(env, 'JWT_SECRET');
}
