// lib/passkeys.ts — F#73 PASSKEYS (client WebAuthn helper)
// ============================================================
// مطبق حرفيا على أدلة modern-web-guidance:
//   passkeys · passkey-registration · passkey-authentication
//   passkey-management · passkey-conditional-create
//
// القواعد الذهبية من الأدلة:
//   • الclient كيستعمل APIs الأصلية (parseCreationOptionsFromJSON /
//     parseRequestOptionsFromJSON / toJSON) — بلا wrappers تاع مكتبة
//     (الدليل كيمنع صراحة startRegistration/startAuthentication فالclient)
//   • rpId ديما من رد السيرفر (publicKey.rp.id / publicKey.rpId) — عمره ما
//     window.location.hostname (الدليل كيكرر هاد القاعدة فكل guide)
//   • Signal API: feature-detection + base64url validation + console.warn
//     ماشي console.error (Lighthouse errors-in-console — دليل management §98)
//   • webauthn-polyfills بdynamic import (بلا كسر SSR — التقييم فالمتصفح فقط)
//   • try/catch منفصلين: WebAuthn exceptions ضد فشل السيرفر
// ============================================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

export interface PasskeyCredInfo {
  id: string;
  name: string;
  aaguid: string | null;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
  registeredAt: number | null;
  lastUsedAt: number | null;
}

export interface PasskeyListResult {
  rpId: string;
  userId: string;
  credentials: PasskeyCredInfo[];
}

export interface PasskeyUserData {
  id: number;
  name: string;
  email: string;
}

export type PasskeyLoginResult =
  | { ok: true; token: string; user: PasskeyUserData }
  | { ok: false; reason: 'cancelled' | 'error'; message?: string };

export interface PasskeyRegisterOpts {
  token: string;
  /** flow الترقية بعد password → platform authenticator (دليل registration §6) */
  promotion?: boolean;
  /** conditional create صامت بعد login ناجح (دليل conditional-create) */
  conditional?: boolean;
}

// ─── أنواع WebAuthn الحديثة — ما زالوا ناقصين فـlib.dom ديال TS ───────────
interface ClientCapabilities {
  passkeyPlatformAuthenticator?: boolean;
  conditionalGet?: boolean;
  conditionalCreate?: boolean;
}

interface SignalAllAcceptedCredentialsDetails {
  rpId: string;
  userId: string;
  allAcceptedCredentialIds: string[];
}

interface SignalUnknownCredentialDetails {
  rpId: string;
  credentialId: string;
}

interface JsonSerializableCredential {
  id: string;
  rawId: string;
  type: string;
  response: Record<string, unknown>;
  clientExtensionResults?: Record<string, unknown>;
  authenticatorAttachment?: string;
  toJSON(): Record<string, unknown>;
}

interface PKCStatics {
  getClientCapabilities?(): Promise<ClientCapabilities>;
  signalAllAcceptedCredentials?(details: SignalAllAcceptedCredentialsDetails): Promise<void>;
  signalUnknownCredential?(details: SignalUnknownCredentialDetails): Promise<void>;
  signalCurrentUserDetails?(details: Record<string, unknown>): Promise<void>;
  parseRequestOptionsFromJSON?(optionsJSON: Record<string, unknown>): PublicKeyCredentialRequestOptions;
  parseCreationOptionsFromJSON?(optionsJSON: Record<string, unknown>): PublicKeyCredentialCreationOptions;
}

const errName = (err: unknown): string =>
  typeof err === 'object' && err !== null && 'name' in err ? String((err as { name?: unknown }).name) : '';

const errMsg = (data: unknown, fallback: string): string => {
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message) return d.message;
    if (typeof d.error === 'string' && d.error) return d.error;
  }
  return fallback;
};

// ─── polyfill (lazy — بلا أثر على SSR ولا على الحزمة الأولى) ──────────────
let polyfillLoaded = false;
async function ensurePolyfill(): Promise<void> {
  if (polyfillLoaded || typeof window === 'undefined') return;
  polyfillLoaded = true;
  try {
    await import('webauthn-polyfills');
  } catch {
    // بلا polyfill — المتصفحات الحديثة عندهم الstatics أصلا
  }
}

const pkc = (): PKCStatics | null =>
  typeof window !== 'undefined'
    ? ((window as unknown as { PublicKeyCredential?: PKCStatics }).PublicKeyCredential ?? null)
    : null;

// ─── Feature detection (دليل management §259 + registration §89) ──────────
export async function pkCapabilities(): Promise<ClientCapabilities | null> {
  await ensurePolyfill();
  const P = pkc();
  if (!P || typeof P.getClientCapabilities !== 'function') return null;
  try {
    return await P.getClientCapabilities();
  } catch {
    return null;
  }
}

export async function pkSupported(): Promise<boolean> {
  const caps = await pkCapabilities();
  if (!caps) return false;
  // الدخول بالزر يحتاج platform authenticator؛ الconditional UI يحتاج conditionalGet
  return Boolean(caps.passkeyPlatformAuthenticator || caps.conditionalGet);
}

// ─── Signal API (دليل management — مزامنة password managers) ──────────────
// base64url صالح: [A-Za-z0-9_-] بلا = و length%4 !== 1 — المتصفح كيرفض غير هادا
function isValidBase64Url(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length % 4 !== 1 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function syncAcceptedCredentials(
  rpId: string,
  userId: string,
  credentials: PasskeyCredInfo[]
): Promise<void> {
  const P = pkc();
  if (!P || typeof P.signalAllAcceptedCredentials !== 'function') return;
  const ids = credentials.map((c) => c.id);
  if (!rpId || !isValidBase64Url(userId) || !ids.every(isValidBase64Url)) {
    console.warn('SignalAllAcceptedCredentials skipped: rpId/userId/credentialIds base64url validation failed.');
    return;
  }
  try {
    await P.signalAllAcceptedCredentials({ rpId, userId, allAcceptedCredentialIds: ids });
  } catch (e) {
    console.warn('SignalAllAcceptedCredentials sync warning:', e); // warn ماشي error — دليل management §98
  }
}

// signalUnknownCredential — عند فشل تحقق السيرفر باش ما يبقاوش orphaned credentials
async function signalUnknown(rpId: string | undefined, credentialId: string): Promise<void> {
  const P = pkc();
  if (!P || typeof P.signalUnknownCredential !== 'function' || !rpId) return;
  try {
    await P.signalUnknownCredential({ rpId, credentialId });
  } catch (e) {
    console.warn('SignalUnknownCredential sync warning:', e);
  }
}

// ─── Conditional UI (autofill) — دليل passkey-authentication §71-129 ──────
let autofillController: AbortController | null = null;

export function abortAutofill(): void {
  if (autofillController) {
    autofillController.abort();
    autofillController = null;
  }
}

/**
 * تشغيل الconditional mediation على صفحة /auth — يقترح الpasskeys فالautofill
 * ديال خانة الusername بلا أي dialog. onSuccess كيستقبل نفس رد /api/login.
 * كيرجع دالة تنظيف (abort) للuseEffect.
 */
export function startConditionalLogin(
  onSuccess: (data: { token: string; user?: PasskeyUserData | Record<string, unknown> }) => void
): () => void {
  abortAutofill();
  const P = pkc();

  (async () => {
    if (!P || typeof navigator === 'undefined' || !navigator.credentials) return;
    const caps = await pkCapabilities();
    if (!caps || caps.conditionalGet !== true) return; // بلا conditionalGet — بلا autofill suggestions

    let optionsJSON: Record<string, unknown>;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/passkey/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      optionsJSON = (await res.json()) as Record<string, unknown>;
    } catch {
      return; // السيرفر طايح/صاحي — بلا دشوار فالUI
    }

    const publicKey = P.parseRequestOptionsFromJSON?.(optionsJSON);
    if (!publicKey) return;
    const ctrl = new AbortController();
    autofillController = ctrl;

    try {
      const credential = await navigator.credentials.get({
        publicKey,
        signal: ctrl.signal,
        mediation: 'conditional',
      });

      const encoded = (credential as unknown as JsonSerializableCredential | null)?.toJSON();
      if (!encoded) return;
      // try/catch منفصل لفشل السيرفر (قاعدة الدليل §81)
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/passkey/login/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encoded),
        });
        if (!res.ok && res.status === 404) {
          await signalUnknown(publicKey.rpId, encoded.id as string);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { token?: string; user?: PasskeyUserData | Record<string, unknown> };
        if (data && data.token) onSuccess(data as { token: string; user?: PasskeyUserData | Record<string, unknown> });
      } catch (serverErr) {
        console.warn('Conditional passkey verification error:', serverErr);
      }
    } catch (err) {
      // NotAllowedError/AbortError = إلغاء عادي — صمت (دليل authentication §124)
      if (['NotAllowedError', 'AbortError'].includes(errName(err))) return;
      console.warn('Unexpected conditional get error:', err);
    }
  })();

  return abortAutofill;
}

// ─── الدخول بالزر الصريح — دليل passkey-authentication §132-175 ───────────
export async function passkeyLogin(): Promise<PasskeyLoginResult> {
  await ensurePolyfill();
  const P = pkc();
  if (!P || typeof navigator === 'undefined' || !navigator.credentials) {
    return { ok: false, reason: 'error', message: 'Passkeys are not supported in this browser.' };
  }

  // إلغاء أي conditional get معلق قبل الprompt الصريح (دليل authentication §69)
  abortAutofill();
  const ctrl = new AbortController();
  autofillController = ctrl;

  let optionsJSON: Record<string, unknown>;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/passkey/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, reason: 'error', message: errMsg(data, 'Could not start passkey sign-in.') };
    }
    optionsJSON = data;
  } catch {
    return { ok: false, reason: 'error', message: 'Connection error. Please try again.' };
  }

  const publicKey = P.parseRequestOptionsFromJSON?.(optionsJSON);
  if (!publicKey) return { ok: false, reason: 'error', message: 'Could not start passkey sign-in.' };

  let credential: JsonSerializableCredential | null;
  try {
    const result = await navigator.credentials.get({ publicKey, signal: ctrl.signal });
    credential = result as unknown as JsonSerializableCredential | null;
  } catch (err) {
    if (errName(err) === 'NotAllowedError' || errName(err) === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'error', message: 'Passkey sign-in failed. Please try again.' };
  }
  if (!credential) return { ok: false, reason: 'cancelled' };

  const encoded = credential.toJSON();
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/passkey/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encoded),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      if (res.status === 404) await signalUnknown(publicKey.rpId, encoded.id as string);
      return { ok: false, reason: 'error', message: errMsg(data, 'Passkey verification failed.') };
    }
    if (data && typeof data.token === 'string') {
      return { ok: true, token: data.token, user: data.user as PasskeyUserData };
    }
    return { ok: false, reason: 'error', message: 'Unexpected server response.' };
  } catch {
    return { ok: false, reason: 'error', message: 'Connection error verifying your passkey.' };
  }
}

// ─── التسجيل — دليل passkey-registration + passkey-conditional-create ─────
export async function passkeyRegister(opts: PasskeyRegisterOpts): Promise<{ ok: boolean; message?: string }> {
  await ensurePolyfill();
  const P = pkc();
  if (!P || typeof navigator === 'undefined' || !navigator.credentials) {
    return { ok: false, message: 'Passkeys are not supported in this browser.' };
  }
  const silent = opts.conditional === true; // conditional create = صمت تام بلا error UI (دليل §4)

  try {
    const caps = await pkCapabilities();
    if (!caps) return { ok: false, message: 'Passkeys are not supported in this browser.' };
    if (silent && caps.conditionalCreate !== true) return { ok: false };
    if (!silent && caps.passkeyPlatformAuthenticator !== true) {
      return { ok: false, message: 'No platform authenticator available.' };
    }

    // تنظيف الpipeline قبل الcreate — إلزامي حتى للconditional create (دليل conditional-create §1)
    abortAutofill();

    const res = await fetch(`${API_BASE_URL}/api/auth/passkey/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify({ promotion: opts.promotion === true, conditional: opts.conditional === true }),
    });
    const optionsJSON = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !optionsJSON) {
      return { ok: false, message: silent ? undefined : errMsg(optionsJSON, 'Could not start passkey creation.') };
    }

    const publicKey = P.parseCreationOptionsFromJSON?.(optionsJSON);
    if (!publicKey) return { ok: false, message: silent ? undefined : 'Could not start passkey creation.' };

    let credential: JsonSerializableCredential | null;
    try {
      const result = await navigator.credentials.create({
        publicKey,
        ...(opts.conditional === true ? { mediation: 'conditional' as CredentialMediationRequirement } : {}),
      });
      credential = result as unknown as JsonSerializableCredential | null;
    } catch (err) {
      // InvalidStateError = نفس الpasskey موجود · NotAllowedError/AbortError = إلغاء
      if (silent) return { ok: false };
      const name = errName(err);
      if (name === 'InvalidStateError') {
        return { ok: false, message: 'A passkey already exists for this account.' };
      }
      if (name === 'NotAllowedError' || name === 'AbortError') {
        return { ok: false, message: 'Passkey creation was cancelled.' };
      }
      return { ok: false, message: 'Passkey creation failed. Please try again.' };
    }
    if (!credential) return { ok: false, message: silent ? undefined : 'Passkey creation was cancelled.' };

    const encoded = credential.toJSON();
    try {
      const verifyRes = await fetch(`${API_BASE_URL}/api/auth/passkey/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
        body: JSON.stringify(encoded),
      });
      if (!verifyRes.ok) {
        await signalUnknown(publicKey.rp?.id, encoded.id as string);
        const data = (await verifyRes.json().catch(() => ({}))) as Record<string, unknown>;
        return { ok: false, message: silent ? undefined : errMsg(data, 'Passkey verification failed.') };
      }
      return { ok: true };
    } catch (serverErr) {
      await signalUnknown(publicKey.rp?.id, encoded.id as string);
      console.warn('Passkey registration verification error:', serverErr);
      return { ok: false, message: silent ? undefined : 'Connection error verifying your passkey.' };
    }
  } catch (err) {
    if (silent) return { ok: false };
    console.warn('Passkey registration error:', err);
    return { ok: false, message: 'Passkey creation failed. Please try again.' };
  }
}

// ─── الإدارة — دليل passkey-management (CRUD فوق endpoints السيرفر) ───────
export async function listPasskeys(token: string): Promise<PasskeyListResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/passkey/credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not load your passkeys.');
  return res.json();
}

export async function renamePasskey(token: string, id: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/passkey/credentials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(errMsg(data, 'Rename failed.'));
  }
}

export async function deletePasskey(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/passkey/credentials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(errMsg(data, 'Delete failed.'));
  }
}
