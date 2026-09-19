// lib/backend-server.ts
import 'server-only';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

/**
 * استدعاء Backend من السيرفر — server-to-server
 * يمرر تلقائياً كوكي الأدمن (للـ endpoints الإدارية)
 */
export async function backendFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  // 🆕 Next 16 — cookies() async
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;

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

  return res.json() as Promise<T>;
}