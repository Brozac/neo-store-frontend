// lib/sweeper.ts — phase-abc: كنس الطلبات الميتة كل ساعة (البند 7c)
// ═══════════════════════════════════════════════════════════════════════
// الطلبات status='pending' اللي ماجاهاش دفع:
//   · Stripe / Crypto / Paysera → > 2 ساعات → 'cancelled'
//     (بوابات كارت — الجلسة عند Stripe نفسها كتنتهي؛ pending قديم = تلوث)
//   · BaridiMob → > 48 ساعة → 'cancelled'
//     (تحويل بنكي — مهلة 48h كافية حتى مع المراجعة اليدوية؛ 'manual' ما كيلمسوش)
//
/// عقود الأمان:
///   · UPDATE محكوم: status='pending' فقط — العميل المدفوع/اليدوي ما كيتلمس أبداً
///   · idempotent بالكامل (إعادة التشغيل = صفر فروق)
///   · الكونس نظام_events كيتسجل (فسح + كشف)
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { openRwSql, logSystemEvent } from './cron-db';

export interface SweepResult {
  ok: boolean;
  cancelled2h: number;
  cancelled48h: number;
  ms: number;
  error?: string;
}

export async function sweepPendingOrders(env: CfCronEnv): Promise<SweepResult> {
  const t0 = Date.now();
  const base: SweepResult = { ok: false, cancelled2h: 0, cancelled48h: 0, ms: 0 };
  const sql = await openRwSql(env);
  if (!sql) return { ...base, ms: Date.now() - t0, error: 'rw_unavailable' };

  try {
    // 1) بوابات كارت/كريبتو — أقدم من ساعتين
    const r1 = await sql.unsafe(
      `UPDATE orders SET status = 'cancelled'
       WHERE status = 'pending'
         AND payment_method IN ('Stripe', 'Crypto', 'Paysera')
         AND created_at < now() - interval '2 hours'
       RETURNING id`,
    );
    // 2) BaridiMob — أقدم من 48 ساعة
    const r2 = await sql.unsafe(
      `UPDATE orders SET status = 'cancelled'
       WHERE status = 'pending'
         AND payment_method = 'BaridiMob'
         AND created_at < now() - interval '48 hours'
       RETURNING id`,
    );

    const c1 = r1.length;
    const c2 = r2.length;
    await logSystemEvent(
      sql,
      'SWEEPER_DONE',
      {
        gateway2h: c1,
        baridimob48h: c2,
        ids2h: r1.slice(0, 20).map((x) => Number(x.id)),
        ids48h: r2.slice(0, 20).map((x) => Number(x.id)),
      },
      c1 + c2 > 0 ? 'warning' : 'info',
    );
    return { ok: true, cancelled2h: c1, cancelled48h: c2, ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[sweeper] failed:', msg);
    return { ...base, ms: Date.now() - t0, error: msg };
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}
