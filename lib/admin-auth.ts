// lib/admin-auth.ts — Phase I: حارس الجلسة الإدارية same-origin
// ═══════════════════════════════════════════════════════════════════════
// · admin_token_next — كوكي موقّع HS256 بـ JWT_SECRET (نفس محرك pb-jwt)
//   · يصدر من /api/admin/login (proxy إلى rpc + كوكي مزدوج)
//   · admin_token القديم (من rpc) يبقى للـ endpoints الباقية على rpc
//     (settings · system-events · webhook) — عقدان مستقلان لا يتعارضان
// · 401 بلا كوكي/توكن فاسد · 403 Origin أجنبي على الطفرات (CSRF)
// · صفر شبكة في التحقق — الـ verify محلي (Render نائم وما كيتسألش أبداً)
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { NextResponse } from 'next/server';
import { pbVerifyJwt, getPbJwtSecret } from './pb/pb-jwt';
import { pbOriginOk } from './pb/pb-user';

export const ADMIN_COOKIE = 'admin_token_next';

/** عمر الجلسة — 4h (نفس تقدير admin_hint في middleware.ts) */
export const ADMIN_TTL_SECONDS = 4 * 60 * 60;

export function adminExtractToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** التحقق الخام — للـ routes اللي كتجمع بين جلسة الزبون والجلسة الإدارية (upload) */
export async function requireAdmin(request: Request): Promise<{ role: string } | null> {
  const token = adminExtractToken(request);
  if (!token) return null;
  const secret = await getPbJwtSecret();
  if (!secret) return null;
  const payload = await pbVerifyJwt(token, secret);
  if (!payload || payload.role !== 'admin') return null;
  return { role: 'admin' };
}

/**
 * الحارس الموحد — null يعني مسموح، Response يعني أوقف.
 * الطفرات (POST/PUT/PATCH/DELETE) كتطلب Origin مسموح (CSRF guard).
 */
export async function adminGuard(request: Request): Promise<Response | null> {
  const token = adminExtractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const secret = await getPbJwtSecret();
  if (!secret) return NextResponse.json({ error: 'Server error' }, { status: 500 });
  const payload = await pbVerifyJwt(token, secret);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const method = (request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !pbOriginOk(request)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }
  return null;
}
