// lib/cj-token-kv.ts — phase-abc: طبقة KV فوق توكن CJ (البند 5 — خطر daily limit)
// ═══════════════════════════════════════════════════════════════════════
// المشكل الحي: التوكن in-memory per-isolate — كل isolate جديد كيصيفط auth
//   جديد لـ CJ. CJ عندها حدود يومية على /authentication — ملفوف isolates
//   كثيرة (كل PoP · كل restart) = استهلاك لا لازوم.
// الحل: التوكن كيتشارك عبر KV (STORE_KV/NEXT_INC_CACHE_KV):
//   memory hit → استعمل (نفس السلوك اليوم)
//   memory miss → KV read → سليم؟ استعمل + عمّر الذاكرة
//   ولا → التدفق الحي (refresh/getAccessToken) → كتابة KV (fire-safe)
// الهامش: 15 دقيقة (كان 10) — قبل انتهاء التوكن الفعلي.
// ═══════════════════════════════════════════════════════════════════════
import { kvGetJson, kvPutJson } from './kv-store';

const CJ_TOKEN_KV_KEY = 'cj:token:v2';
/** هامش الأمان قبل الـ expiry — 15 دقيقة (كان 10 — البند 5 كيطلبه) */
export const CJ_TOKEN_MARGIN_MS = 15 * 60 * 1000;
/** TTL الحد الأقصى للكتابة — التوكن الحي 12h → نخزن 13h باش يبقى حتى مع تأخير */
const CJ_TOKEN_KV_TTL_S = 13 * 60 * 60;

export interface CjTokenKvEntry {
  token: string;
  refreshToken?: string;
  /** expiry المطلق الفعلي (بلا هامش) — epoch ms */
  expiryMs: number;
  /** epoch ms الكتابة — للتشخيص */
  at: number;
}

export async function readCjTokenKv(): Promise<CjTokenKvEntry | null> {
  const e = await kvGetJson<CjTokenKvEntry>(CJ_TOKEN_KV_KEY);
  if (!e || typeof e.token !== 'string' || !e.token) return null;
  if (typeof e.expiryMs !== 'number' || !Number.isFinite(e.expiryMs)) return null;
  return e;
}

export function isCjTokenUsable(e: CjTokenKvEntry | null, nowMs = Date.now()): boolean {
  if (!e) return false;
  return nowMs < e.expiryMs - CJ_TOKEN_MARGIN_MS;
}

/** كتابة fire-safe — كتجيب true إلا كتبات (للأغراض التشخيصية فقط) */
export async function writeCjTokenKv(
  token: string,
  refreshToken: string | null,
  expiryMs: number,
): Promise<boolean> {
  if (!token || !Number.isFinite(expiryMs)) return false;
  const entry: CjTokenKvEntry = {
    token,
    ...(refreshToken ? { refreshToken } : {}),
    expiryMs,
    at: Date.now(),
  };
  return kvPutJson(CJ_TOKEN_KV_KEY, entry, CJ_TOKEN_KV_TTL_S);
}
