// lib/admin-db.ts — Phase I: نداءات الدوال المضيقة phasei_* / phasef_* عبر laclarc_rw
// ═══════════════════════════════════════════════════════════════════════
// · كل كتابة = دالة SECURITY DEFINER (REVOKE FROM PUBLIC · GRANT laclarc_rw فقط)
// · ما كاينش SQL حر من الـ body — غير parameters
// · الإغلاق بنفس نمط phasec-db المثبت حياً (finally + end 5s)
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getRwSql, type RwSql } from './pb/pb-db';

/** كل العمليات داخل وحدة واحدة — الاتصال يتفتح ويسد في نفس الطلب */
export async function withDb<T>(fn: (sql: RwSql) => Promise<T>): Promise<T | null> {
  const sql = await getRwSql();
  if (!sql) return null;
  try {
    return await fn(sql);
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* idle_timeout backstop — نفس نمط phasec-db الحي */
    }
  }
}

/** نداء دالة مضيقة — يرجع jsonb الناتج (null على فشل DB) */
export async function callFn(
  sql: RwSql,
  name: string,
  params: unknown[],
): Promise<Record<string, unknown> | null> {
  const ph = params.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await sql.unsafe(`SELECT public.${name}(${ph}) AS r`, params);
  return (rows[0]?.r ?? null) as Record<string, unknown> | null;
}

/** أخطاء الجرس الدلالية → كود HTTP (price_floor/duplicate → 400 · already_booked → 409 · not_found → 404) */
export function statusFor(r: Record<string, unknown> | null): number {
  const err = String((r as { error?: string })?.error ?? '');
  if (err === 'already_booked' || err === 'exchange_order' || err === 'bad_status') return 409;
  if (err === 'not_found') return 404;
  return 400;
}
