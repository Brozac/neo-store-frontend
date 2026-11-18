// lib/backend-server.ts
import 'server-only';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

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

  const res = await fetch(`${BACKEND_URL}${path}`, {
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