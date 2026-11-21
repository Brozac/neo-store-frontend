// app/api/auth/passkey/_pb-passkey.ts — Phase C: أدوات WebAuthn المشتركة (server helpers)
// ═══════════════════════════════════════════════════════════════════════
// نقل حرفي من nsb/routes/webauthn.js (F#73 PASSKEYS) — مع طبقة الداتا الجديدة:
// الجداول ما كيتلمسوش مباشرة؛ كلشي عبر الدوال SECURITY DEFINER phasef_webauthn_*
// (نفس الذرية: challenge_take = DELETE...RETURNING · restore عند فشل التحقق).
//
// ملاحظة إصدار: nsf مركّب فيه @simplewebauthn/server v9.0.3 (ماشي v14 تاع nsb —
// ممنوع نلمس package.json) → الفروق المجرّبة هنا:
//   • userID: string كيدوز كما هو لـ options.user.id → كنمررو base64url(utf8(user.id))
//     باش الhandle يبقى نفسو حرفياً مع الباك القديم (v14 كان كيشفّر Uint8Array)
//   • excludeCredentials[].id خاصو Buffer/Uint8Array + type:'public-key' (v9 كيشفّر من جديد)
//   • verifyRegistrationResponse ما عندش requireUserPresence فـv9 (UP كيفرض دايماً)
//   • registrationInfo.credentialID = Uint8Array → b64u() قبل التخزين
//   • verifyAuthenticationResponse كياخد authenticator: {credentialID, credentialPublicKey,
//     counter, transports} (v13 بدّل الاسم لـcredential)
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import type {
  GenerateRegistrationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { pbClientIp, pbRateLimit } from '@/lib/pb/pb-limiter';
import { pbCsrfOk, pbExtractToken } from '@/lib/pb/pb-secure-checkout';
import { getPbJwtSecret, pbVerifyJwt, type PbJwtPayload } from '@/lib/pb/pb-jwt';
import { getPbRuntime, pbVar } from '@/lib/pb/pb-env';
import type { RwSql } from '@/lib/pb/pb-db';

// ─── RP config — ثوابت من env مع defaults آمنة (نفس الباك) ───────────────
export interface PbRpConfig {
  rpId: string;
  rpName: string;
  origins: string[];
}

export async function pbRpConfig(): Promise<PbRpConfig> {
  const { env } = await getPbRuntime();
  const rpId = pbVar(env, 'PASSKEY_RP_ID') || 'laclarc.com';
  const rpName = pbVar(env, 'PASSKEY_RP_NAME') || 'Laclarc';
  const raw = pbVar(env, 'PASSKEY_ORIGINS') || 'https://laclarc.com,https://www.laclarc.com';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { rpId, rpName, origins };
}

// ─── أدوات base64url — نفس b64u تاع الباك ─────────────────────────────────
export function pbB64u(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

/** user handle مستقر للحساب — base64url(utf8(user.id)) · نفس الباك القديم حرفياً */
export function pbUserHandle(userId: number): string {
  return pbB64u(Buffer.from(String(userId), 'utf8'));
}

/** استخراج الchallenge من clientDataJSON (الرد ديال credential.toJSON() مهما كان الحفل) */
export function pbExtractChallenge(webauthnResponse: unknown): string | null {
  try {
    const wrapper = webauthnResponse as { response?: { clientDataJSON?: unknown } } | null;
    const cdj = wrapper && wrapper.response ? wrapper.response.clientDataJSON : undefined;
    if (!cdj || typeof cdj !== 'string') return null;
    const data = JSON.parse(Buffer.from(cdj, 'base64url').toString('utf8')) as { challenge?: unknown };
    return typeof data.challenge === 'string' ? data.challenge : null;
  } catch {
    return null;
  }
}

/** transports آمنة للمكتبة (AuthenticatorTransportFuture[] | undefined) — من DB ولا client */
export type PkTransports = NonNullable<
  GenerateRegistrationOptionsOpts['excludeCredentials']
>[number]['transports'];
export function pbTransportsOf(v: unknown): PkTransports {
  return Array.isArray(v) ? (v as unknown as PkTransports) : undefined;
}

// ─── Rate limits — نفس حدود الباك (options 30/15m · verify 10/15m per IP) ─
// login/options كيتطلع أوتوماتيكيا فكل تحميل ديال صفحة /auth (conditional UI)
// → حد منفصل على authLimiter باش ما يحرقش المحاولات.
export function pbPasskeyLimitOptions(request: Request): NextResponse | null {
  if (pbRateLimit(`pk-options:${pbClientIp(request)}`, 30, 15 * 60 * 1000)) return null;
  return NextResponse.json({ error: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
}

export function pbPasskeyLimitVerify(request: Request): NextResponse | null {
  if (pbRateLimit(`pk-verify:${pbClientIp(request)}`, 10, 15 * 60 * 1000)) return null;
  return NextResponse.json({ message: 'Too many attempts, please try again after 15 minutes.' }, { status: 429 });
}

// ─── نفس middleware تاع الباك (Bearer JWT + كوكي الجلسة F-H1) ─────────────
export type PbPasskeyAuth =
  | { ok: true; user: PbJwtPayload }
  | { ok: false; res: NextResponse };

export async function pbPasskeyAuth(request: Request): Promise<PbPasskeyAuth> {
  const { token, viaCookie } = pbExtractToken(request);
  if (!token) {
    return { ok: false, res: NextResponse.json({ message: 'Access Denied: No token provided' }, { status: 401 }) };
  }
  // 🩹 F-H1: طلب مغيّر مصادق بالكوكي فقط → فحص Origin (نفس درع الباك — pattern my-orders)
  if (!pbCsrfOk(request, viaCookie)) {
    return { ok: false, res: NextResponse.json({ message: 'Forbidden origin' }, { status: 403 }) };
  }
  const secret = await getPbJwtSecret();
  if (!secret) {
    return { ok: false, res: NextResponse.json({ error: 'Server error' }, { status: 500 }) };
  }
  const user = await pbVerifyJwt(token, secret);
  if (!user) {
    return { ok: false, res: NextResponse.json({ message: 'Invalid or expired token' }, { status: 403 }) };
  }
  return { ok: true, user };
}

export function pbPasskeyUserId(user: PbJwtPayload): number {
  return Number(user.id);
}

// ─── طبقة الداتا — phasef_webauthn_* SECURITY DEFINER حصراً ────────────────
export interface PbChallengeRow {
  id: string;
  challenge: string;
  type: 'registration' | 'authentication';
  user_id: number | null;
  uv: string;
  conditional: boolean;
}

/** صف واحد من دوال phasef_* — postgres.js كيرجع jsonb كـ object مفكوك أصلاً */
export async function pbPhasefRow<T>(
  sql: RwSql,
  query: string,
  params: unknown[],
): Promise<T | null> {
  const rows = await sql.unsafe(query, params);
  return ((rows[0]?.r ?? null) as T | null);
}

/**
 * تخزين الchallenge (type registration|authentication) — الدالة كتنظّف المنتهية
 * أصلاً (نفس pruneExpiredChallenges تاع الباك) + ON CONFLICT (challenge) DO NOTHING.
 */
export async function pbChallengePut(
  sql: RwSql,
  a: { challenge: string; type: 'registration' | 'authentication'; userId: number | null; uv: string; conditional: boolean },
): Promise<boolean> {
  const r = await pbPhasefRow<{ ok: boolean }>(
    sql,
    'SELECT phasef_webauthn_challenge_put($1, $2, $3, $4, $5, $6) AS r',
    [crypto.randomUUID(), a.challenge, a.type, a.userId, a.uv, a.conditional],
  );
  return r?.ok === true;
}

/** استهلاك ذري للchallenge: DELETE...RETURNING داخل الدالة = استعمال واحد مضمون */
export async function pbChallengeTake(
  sql: RwSql,
  challenge: string,
  type: 'registration' | 'authentication',
): Promise<PbChallengeRow | null> {
  return pbPhasefRow<PbChallengeRow>(
    sql,
    'SELECT phasef_webauthn_challenge_take($1, $2) AS r',
    [challenge, type],
  );
}

// 🩹 B-L12: الchallenge كيتستهلك قبل التحقق → فشل تحقق واحد يُجبر إعادة options.
//   الإصلاح نفس الباك: نعاود نُدرج السجل عند فشل التحقق (الاستهلاك الذري عند
//   النجاح كيمنع الـ replay). فشل الrestore ما كيوقّفش الرد (نفس السلوك القديم).
export async function pbChallengeRestore(sql: RwSql, row: PbChallengeRow): Promise<void> {
  try {
    await sql.unsafe('SELECT phasef_webauthn_challenge_restore($1::jsonb) AS r', [JSON.stringify(row)]);
  } catch (e) {
    pbWarn('challenge restore', e);
  }
}

// ─── audit — نظام الأحداث (نفس auditEvent تاع الباك: fire-and-forget) ─────
// الباك كان كيدوز userId فخانة order_id — نفس العرف هنا عبر phasef_event.
export function pbPasskeyAudit(
  sql: RwSql,
  waitUntil: (p: Promise<unknown>) => void,
  type: 'PASSKEY_REGISTERED' | 'PASSKEY_LOGIN' | 'PASSKEY_DELETED',
  userId: number,
  details: Record<string, unknown>,
): void {
  waitUntil(
    sql
      .unsafe('SELECT phasef_event($1, $2, $3::jsonb, $4) AS r', [type, userId, JSON.stringify(details), 'info'])
      .catch(() => {}),
  );
}

// ─── logging — نمط الدار: بلا صمت ──────────────────────────────────────────
export function pbWarn(ctx: string, e: unknown): void {
  console.warn(`[pb-passkey] ${ctx} failed:`, e instanceof Error ? e.message : e);
}

/** بودي JSON آمن — الstream كيتقرا مرة وحدة */
export async function pbJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── أنواع الاستيراد المعرّضة (للcast فالroutes) ───────────────────────────
export type {
  GenerateRegistrationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
};
