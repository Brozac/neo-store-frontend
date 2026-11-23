// lib/cron-db.ts — phase-abc: عملاء SQL للكرون (خارج getCloudflareContext)
// ═══════════════════════════════════════════════════════════════════════
// 🚨 درس معماري: getCloudflareContext كيخدم فقط داخل تدفق fetch تاع OpenNext.
//    داخل scheduled() الكونتكس ما كاينش — الـ cron كيتحصل على env مباشرة من
//    custom-worker.ts. هادا الوحيد اللي كيفتح عملاء postgres من env المعطى:
//   · openRwSql(env) ← env.RW_DATABASE_URL (سرّ laclarc_rw — موجود حياً)
//   · openRoSql(env) ← env.HYPERDRIVE.connectionString (laclarc_ro SELECT فقط)
//
// ⚠️ الإغلاق: هنا إغلاق صريح فـ finally مسموح — عكس pb-db (إغلاق مؤجل 8s) —
//    لأن الـ cron كيجري كل الاستعلامات بالتتابع قبل ما يسد (ما كاينش سباق
//    waitUntil/طلب). ما تستعملش هاد العملاء فـ routes fetch — استعمل getRwSql.
// ═══════════════════════════════════════════════════════════════════════

export interface CronSql {
  unsafe(query: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  end(opts?: { timeout?: number }): Promise<void>;
}

async function openSql(cs: string): Promise<CronSql> {
  const { default: postgres } = await import('postgres');
  return postgres(cs, {
    max: 1,
    prepare: false, // إجباري مع Supavisor + Workers (نفس انضباط db-ro/pb-db)
    connect_timeout: 15,
    idle_timeout: 5,
  }) as unknown as CronSql;
}

/** الكتابة — env.RW_DATABASE_URL (سرّ موجود حياً — نفسه pb-db) */
export async function openRwSql(env: CfCronEnv): Promise<CronSql | null> {
  const cs =
    typeof env.RW_DATABASE_URL === 'string' && env.RW_DATABASE_URL
      ? env.RW_DATABASE_URL
      : (typeof process.env.RW_DATABASE_URL === 'string' ? process.env.RW_DATABASE_URL : '');
  if (!cs) {
    console.warn('[cron-db] RW_DATABASE_URL missing — write task skipped');
    return null;
  }
  try {
    return await openSql(cs);
  } catch (e) {
    console.warn('[cron-db] rw open failed:',
      e instanceof Error ? e.message : e);
    return null;
  }
}

/** القراءة — env.HYPERDRIVE.connectionString (laclarc_ro — SELECT فقط بـ RLS) */
export async function openRoSql(env: CfCronEnv): Promise<CronSql | null> {
  const cs = env.HYPERDRIVE?.connectionString ||
    (typeof process.env.DIRECT_DATABASE_URL === 'string' ? process.env.DIRECT_DATABASE_URL : '');
  if (!cs) {
    console.warn('[cron-db] HYPERDRIVE connectionString missing — read task skipped');
    return null;
  }
  try {
    return await openSql(cs);
  } catch (e) {
    console.warn('[cron-db] ro open failed:',
      e instanceof Error ? e.message : e);
    return null;
  }
}

/** سجل أحداث موحّد — system_events (نفس الجدول اللي كيستعمله rpc) */
export async function logSystemEvent(
  sql: CronSql,
  eventType: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warning' | 'error' = 'info',
  orderId: number | null = null,
): Promise<void> {
  try {
    await sql.unsafe(
      `INSERT INTO system_events (event_type, order_id, details, severity)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [eventType.slice(0, 120), orderId, JSON.stringify(details), severity],
    );
  } catch (e) {
    console.warn('[cron-db] logSystemEvent failed:',
      e instanceof Error ? e.message : e);
  }
}
