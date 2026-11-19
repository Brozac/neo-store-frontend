// lib/pb/pb-db.ts — Phase B: اتصال Supabase بدور laclarc_rw — اتصال لكل طلب
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ الدرس المثبت حياً (تقرير Phase B — إصلاح #1): الـ pool المخزن عالمياً
//   كيتلغى بين الطلبات على Workers (cross-request promise resolution) →
//   50% فشل عابر. الحل: اتصال جديد لكل طلب + إغلاق عبر ctx.waitUntil.
//
// 🔒 الأمان: الدور laclarc_rw — صلاحيات مضيقة حتى بالعمود:
//   orders: INSERT(col-list)/SELECT/UPDATE(col-list) — بلا DELETE أبداً
//   order_items: INSERT(col-list)/SELECT · coupons: SELECT + UPDATE(used_count)
//   store_settings: SELECT + كتابة على stripe_coupon_* فقط (RLS)
//   products/shipping_matrix/payment_gateways: SELECT · users: بلا أي وصول
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getPbRuntime, pbVar } from './pb-env';

export interface RwSql {
  unsafe(query: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  end(opts?: { timeout?: number }): Promise<void>;
}

/**
 * اتصال rw جديد لكل طلب. الإغلاق كيتسجل أوتوماتيكياً فـ waitUntil —
 * ما تنساش تستعمل الـ client نفسو فالطلب الواحد فقط.
 */
export async function getRwSql(): Promise<RwSql | null> {
  try {
    const { env, waitUntil } = await getPbRuntime();
    const cs = pbVar(env, 'RW_DATABASE_URL');
    if (!cs) return null;
    const { default: postgres } = await import('postgres');
    const sql = postgres(cs, {
      max: 1,
      prepare: false,       // إجباري مع Supavisor pooler + Workers
      connect_timeout: 15,
      idle_timeout: 5,
    }) as unknown as RwSql;
    // 🔧 إصلاح مثبت بالـ diag الحي (2026-11-19 — laclarc-pbdiag):
    // end() الفوري داخل waitUntil كان كيبدا يسد الـ pool قبل أول query →
    // كل العمليات RW كتفشل فورياً بـ `write CONNECTION_ENDED` (0ms).
    // الحل المثبت حياً: الإغلاق مؤجَّل 8s (الطلب يسالى قبل) + idle_timeout backstop.
    waitUntil(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          void sql.end({ timeout: 3 }).catch(() => {});
          resolve();
        }, 8000);
      }),
    );
    return sql;
  } catch (e) {
    console.warn('[pb-db] rw init failed:',
      e instanceof Error ? e.message : e);
    return null;
  }
}

/** مساعد صغير: واش الـ rw متوفر أصلاً (للـ proxy-first decision logs) */
export async function hasRwDatabase(): Promise<boolean> {
  const { env } = await getPbRuntime();
  return Boolean(pbVar(env, 'RW_DATABASE_URL'));
}
