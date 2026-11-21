// lib/backend-server.ts
import 'server-only';
import { cookies } from 'next/headers';

// 🩹 Phase F — سوء التوجيه الحي (أكتشاف 2026-11-22): NEXT_PUBLIC_API_URL (var تاع
//   الـ worker = https://api.laclarc.com) كان كيربح الـ fallback → نداءات exchange/admin
//   كيضربو في نفس الـ worker (404 ذاتي). الآن: rpc صريح دايماً — validate-coupon
//   النسبي باقي محلي (الفحص فالمسارات أدناه).
const BACKEND_URL =
  process.env.RPC_INTERNAL_URL || 'https://rpc.laclarc.com';

/**
 * استدعاء Backend من السيرفر — server-to-server
 * يمرر تلقائياً كوكي الأدمن (للـ endpoints الإدارية)
 *
 * 🩹 Hardening:
 *   - BackendError + res.ok check (5xx/4xx تُرمى لا تُمرر كجسم بيانات)
 *   - مسارات اللوج تُعقَّم: t= (exchange token) يُستبدل بـ *** قبل أي throw
 *     (كان التوكن يُسجل نصاً في Render logs — نفس عائلة تسريب track/:id)
 */
function sanitizePath(path: string): string {
  // يغطي t= / token= / session_id= — أي بارامتر هوية حساس
  return path.replace(/([?&])(t|token|session_id)=[^&]+/g, '$1$2=***');
}

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
}

const NO_CONTENT = new Set([204, 205]);

// 🩹 Phase F — المسارات اللي عندها JIT route محلية على laclarc.com نفسها (ماكاينش فالـ rpc):
//   validate-coupon = route محلية (Phase B). الباقي (exchange/admin) على rpc.
const SELF_PATHS = new Set(['/api/validate-coupon']);

export async function backendFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  // 🆕 Next 16 — cookies() async
  // 🩹 SECURITY-FIX (audit 2026-11-18 F-M2): كوكي الأدمن كان يُلحق بكل النداءات
  //   حتى العامة (validate-coupon / exchange) — تراكم صلاحيات غير لازم.
  //   توّا: يُلحق فقط عند auth: true (المسارات الإدارية صراحةً).
  const adminToken = init.auth
    ? (await cookies()).get('admin_token')?.value
    : undefined;

  const base = SELF_PATHS.has(path) ? '' : BACKEND_URL;
  const res = await fetch(`${base}${path}`, {
    method: init.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (NO_CONTENT.has(res.status)) return {} as T;

  if (!res.ok) {
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch {}
    // 🩹 FIX — sanitizePath: التوكن لا يصل للسجلات (كان يُطبع نصاً في كل BackendError)
    throw new BackendError(res.status, `Backend ${res.status} on ${sanitizePath(path)}${body ? ` — ${body}` : ''}`);
  }

  return res.json() as Promise<T>;
}