// POST /api/admin/cj-webhook-maintain — تشغيل يدوي لمهام ويبهوك CJ (البند B+D)
// ═══════════════════════════════════════════════════════════════════════
// نفس نمط /api/admin/build-feeds:
//   · adminGuard (جلسة أدمن + CSRF origin)
//   · B → renewCjWebhookSubscriptions: تجديد اشتراكات ويبهوك CJ (30 يوم/اشتراك)
//   · D → reconcileCjOrders: حزام أمان التتبع (طلبات بلا tracking → getOrderDetail)
//   · المهام fail-isolated: فشل وحدة ما يوقفش الأخرة — النتائج في الرد
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { getPbRuntime } from '@/lib/pb/pb-env';
import { renewCjWebhookSubscriptions } from '@/lib/cj-webhook-subs';
import { reconcileCjOrders } from '@/lib/cj-order-reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const { env } = await getPbRuntime();

  // B — تجديد الاشتراكات (idempotent — ما يستهلكش سقف إضافي)
  const subs = await renewCjWebhookSubscriptions(env as CfCronEnv);

  // D — حزام أمان التتبع
  const reconcile = await reconcileCjOrders(env as CfCronEnv);

  return NextResponse.json({
    ok: subs.ok && reconcile.ok,
    subs: {
      ok: subs.ok,
      collected: subs.collected,
      renewed: subs.renewed,
      failed: subs.failed,
      batches: subs.batches,
      ms: subs.ms,
      error: subs.error,
    },
    reconcile: {
      ok: reconcile.ok,
      checked: reconcile.checked,
      tracked: reconcile.tracked,
      completed: reconcile.completed,
      failures: reconcile.failures,
      ms: reconcile.ms,
      error: reconcile.error,
    },
  });
}
