// lib/pb/pb-user.ts — Phase F: حارس JWT للزبائن (نفس authenticateToken الأصلي)
// 401 بلا توكن · 403 توكن فاسد — نفس رسائل الباك القديم حرفياً.
import 'server-only';
import { pbVerifyJwt, getPbJwtSecret, type PbJwtPayload } from './pb-jwt';
import { getPbRuntime, pbVar } from './pb-env';

export interface UserAuth {
  id: number;
  name?: string;
  email?: string;
  payload: PbJwtPayload;
}

export function pbExtractToken(request: Request): string | null {
  const h = request.headers.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) {
    const t = h.slice(7).trim();
    return t || null;
  }
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** يتحقق من توكن الزبون — null إلا أي حاجة غالطة */
export async function pbRequireUser(request: Request): Promise<UserAuth | null> {
  const token = pbExtractToken(request);
  if (!token) return null;
  const secret = await getPbJwtSecret();
  if (!secret) return null;
  const payload = await pbVerifyJwt(token, secret);
  if (!payload || typeof payload.id !== 'number' || payload.id <= 0) return null;
  return { id: payload.id, name: pbStr(payload.name), email: pbStr(payload.email), payload };
}

function pbStr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/** قراءة سر من الـ runtime (worker env ثم process.env) */
export async function pbSecret(name: string): Promise<string | undefined> {
  const { env } = await getPbRuntime();
  return pbVar(env, name);
}

/** حارس Origin للـ mutating مع الكوكيز (نفس النمط فالـ my-orders) */
export function pbOriginOk(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // fetch بدون Origin (curl / same-origin GET)
  try {
    const o = new URL(origin);
    const ok = ['laclarc.com', 'www.laclarc.com'].includes(o.hostname);
    return ok;
  } catch {
    return false;
  }
}
