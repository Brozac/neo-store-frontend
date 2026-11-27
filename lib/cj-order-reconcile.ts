// lib/cj-order-reconcile.ts — حزام أمان التتبع (البند D — عقد المالك 2026-11-27)
// ═══════════════════════════════════════════════════════════════════════
// الويبهوكات (rpc.laclarc.com) هي المسار اللحظي للتتبع — هادا الشبكة الاحتياطية:
//   · كل 6 سوايع: الطلبات المرتبطة بـ CJ وبلا tracking_number → getOrderDetail
//   · tracking/shipped يجيو من CJ مباشرة + سطر في shipment_events
//   · حتى لو الويبهوك فات (auto-close/انقطاع/توقيع مرفوض) — التتبع ما يطيحش عمرو
//
// عقود الأمان:
//   · ما كيبدلش orders.status أبداً (دورة الباك/rpc هي اللي تدير الحالة)
//   · UPDATE محكوم: tracking_number IS NULL برك — idempotent (إعادة التشغيل = صفر فروق)
//   · CAP 20 طلب/دورة — ≤200 نقطة/يوم من 50,000 (سقف النقاط CJ يوليو 2026)
//   · track_heal_checked_at = now() في كل دورة (العمود موجود لهاد الغرض)
//   · فشل طلب → failures++ والبقية تكمل
//
// ملاحظة وقت: CJ يرجع "yyyy-MM-dd HH:mm:ss" — كنفترضو UTC (مطابقة حية مع
// الطلب SD2611180049040665800). التأثير في أسوأ حالة = انزياح عرض تواريخ فقط.
// ═══════════════════════════════════════════════════════════════════════
import { cjFetch } from './cf-cj';
import { openRwSql, logSystemEvent } from './cron-db';

const CAP = 20; // طلبات/دورة
const READ_GAP_MS = 300; // مهلة بين استدعاءات getOrderDetail (QPS قراءة)
const SKIP_STATUSES = ['pending', 'cancelled', 'canceled', 'trash', 'refunded'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ReconcileResult {
  ok: boolean;
  checked: number;
  tracked: number;   // tracking جديد انكشف
  completed: number; // delivered_at عمّر (COMPLETED بلا تتبع)
  failures: number;
  ms: number;
  error?: string;
  lastError?: string; // آخر رسالة فشل (للّوج)
}

interface CjOrderDetail {
  orderNum?: unknown;
  orderStatus?: unknown;
  trackNumber?: unknown;
  outWarehouseTime?: unknown;
  logisticName?: unknown;
}

/** "2026-11-18 00:49:06" → ISO (UTC مفترض) — null إلا ما تفسرتش */
function parseCjTimeUtc(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function reconcileCjOrders(env: CfCronEnv): Promise<ReconcileResult> {
  const t0 = Date.now();
  const base: ReconcileResult = {
    ok: false, checked: 0, tracked: 0, completed: 0, failures: 0, ms: 0,
  };
  const sql = await openRwSql(env);
  if (!sql) return { ...base, ms: Date.now() - t0, error: 'rw_unavailable' };

  try {
    const rows = await sql.unsafe(
      `SELECT id, cj_order_number
       FROM orders
       WHERE cj_order_number IS NOT NULL AND cj_order_number <> ''
         AND (tracking_number IS NULL OR tracking_number = '')
         AND (status IS NULL OR status <> ALL($1::text[]))
       ORDER BY created_at DESC
       LIMIT ${CAP}`,
      [SKIP_STATUSES],
    );

    for (const row of rows) {
      const id = Number(row.id);
      const code = String(row.cj_order_number ?? '').trim();
      if (!code || !Number.isFinite(id)) continue;
      base.checked += 1;
      if (base.checked > 1) await sleep(READ_GAP_MS);

      try {
        const res = await cjFetch('/shopping/order/getOrderDetail', {
          query: { orderId: code },
          timeoutMs: 15000,
        });
        const envData = res.data;
        if (!envData || envData.code !== 200 || !envData.data) {
          base.failures += 1;
          base.lastError = String(envData?.message || `order ${code} bad envelope`);
          continue;
        }
        const o = (envData.data ?? {}) as CjOrderDetail;
        const track = String(o.trackNumber ?? '').trim().slice(0, 80);
        const shipped = parseCjTimeUtc(o.outWarehouseTime);
        const statusRaw = String(o.orderStatus ?? '').trim();
        const isCompleted = statusRaw.toUpperCase() === 'COMPLETED';

        if (track) {
          const upd = await sql.unsafe(
            `UPDATE orders
             SET tracking_number = $1,
                 shipped_at = COALESCE(shipped_at, $2::timestamptz),
                 track_heal_checked_at = now()
             WHERE id = $3 AND (tracking_number IS NULL OR tracking_number = '')
             RETURNING id`,
            [track, shipped, id],
          );
          if (upd.length > 0) {
            base.tracked += 1;
            try {
              await sql.unsafe(
                `INSERT INTO shipment_events (order_id, event_type, status_raw, location, description, event_time)
                 VALUES ($1, 'SHIPPED', $2, NULL, $3, COALESCE($4::timestamptz, now()))`,
                [
                  id,
                  statusRaw || 'SHIPPED',
                  `CJ reconcile — tracking ${track}${o.logisticName ? ` via ${String(o.logisticName)}` : ''}`,
                  shipped,
                ],
              );
            } catch { /* shipment_events fail-open — الـ tracking هو المهم */ }
            if (isCompleted) {
              try {
                await sql.unsafe(
                  `UPDATE orders SET delivered_at = COALESCE(delivered_at, now()) WHERE id = $1 AND delivered_at IS NULL`,
                  [id],
                );
                base.completed += 1;
              } catch { /* fail-open */ }
            }
          }
        } else if (isCompleted) {
          // COMPLETED عند CJ بلا تتبع — عمّر delivered_at (تقريب ≤6h — عرض برك)
          const upd = await sql.unsafe(
            `UPDATE orders SET delivered_at = COALESCE(delivered_at, now()), track_heal_checked_at = now()
             WHERE id = $1 AND delivered_at IS NULL RETURNING id`,
            [id],
          );
          if (upd.length > 0) base.completed += 1;
        } else {
          // ولا جديد — نبض التحقق برك (pacing/dedupe عبر العمود المخصص)
          await sql.unsafe(`UPDATE orders SET track_heal_checked_at = now() WHERE id = $1`, [id]);
        }
      } catch (e) {
        base.failures += 1; // فشل طلب ما يوقفش البقية
        base.lastError = e instanceof Error ? e.message : String(e);
      }
    }

    base.ok = true;
    base.ms = Date.now() - t0;
    await logSystemEvent(
      sql,
      'CJ_ORDER_RECONCILE_DONE',
      {
        checked: base.checked,
        tracked: base.tracked,
        completed: base.completed,
        failures: base.failures,
        ms: base.ms,
        lastError: base.lastError || undefined,
      },
      base.failures > 0 ? 'warning' : 'info',
    );
    return base;
  } catch (e) {
    base.ms = Date.now() - t0;
    base.error = e instanceof Error ? e.message : String(e);
    await logSystemEvent(sql, 'CJ_ORDER_RECONCILE_FAILED', { error: base.error }, 'error');
    return base;
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}
