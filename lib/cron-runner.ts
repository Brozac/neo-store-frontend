// lib/cron-runner.ts — phase-abc: مرسل المهام المجدولة (البند 8)
// ═══════════════════════════════════════════════════════════════════════
// custom-worker.scheduled → runScheduledTask(controller.cron, env):
//   "0 3 * * *"    → buildAllFeeds   (merchant feeds → R2)
//   "0 */6 * * *"  → runDailyPriceSync(200)
//   "0 * * * *"    → sweepPendingOrders
//   ── 🆕 2026-11-27 (CJ webhooks — عقد المالك A+B+C+D) ──
//   "30 4 * * *"   → renewCjWebhookSubscriptions — تجديد اشتراكات ويبهوك CJ
//                    (الصلاحية 30 يوم — تحقيق حي: 999 اشتراك ماتو من 2026-10-12)
//   "20 */6 * * *" → reconcileCjOrders — حزام أمان التتبع (طلبات CJ بلا tracking)
// كل مهمة fail-isolated: فشلها ما كيوقعش الأخرة، والفشل كيتسجل بالتفصيل.
// ═══════════════════════════════════════════════════════════════════════
import { buildAllFeeds } from './merchant-feed-r2';
import { runDailyPriceSync } from './price-sync';
import { sweepPendingOrders } from './sweeper';
import { renewCjWebhookSubscriptions } from './cj-webhook-subs';
import { reconcileCjOrders } from './cj-order-reconcile';

export const CRON_FEEDS = '0 3 * * *';
export const CRON_PRICE_SYNC = '0 */6 * * *';
export const CRON_SWEEPER = '0 * * * *';
export const CRON_WEBHOOK_RENEW = '30 4 * * *';
export const CRON_ORDER_RECONCILE = '20 */6 * * *';

export async function runScheduledTask(cron: string, env: CfCronEnv): Promise<void> {
  const t0 = Date.now();
  try {
    switch (cron) {
      case CRON_FEEDS: {
        const r = await buildAllFeeds(env);
        console.log(
          `[cron:feeds] done ms=${r.totalMs} dzd=${r.dzd.items}(${r.dzd.ok ? 'ok' : r.dzd.skipped ?? 'fail'}) usd=${r.usd.items}(${r.usd.ok ? 'ok' : r.usd.skipped ?? 'fail'}) rate=${r.rate}`,
        );
        break;
      }
      case CRON_PRICE_SYNC: {
        const r = await runDailyPriceSync(env, 200);
        console.log(
          `[cron:price-sync] checked=${r.checked} updated=${r.updated} purged=${r.cachePurged ? 'yes' : 'no'} ms=${r.ms} ${r.error ? 'error=' + r.error : ''}`,
        );
        break;
      }
      case CRON_SWEEPER: {
        const r = await sweepPendingOrders(env);
        console.log(
          `[cron:sweeper] gateway2h=${r.cancelled2h} baridimob48h=${r.cancelled48h} ms=${r.ms} ${r.error ? 'error=' + r.error : ''}`,
        );
        break;
      }
      case CRON_WEBHOOK_RENEW: {
        const r = await renewCjWebhookSubscriptions(env);
        console.log(
          `[cron:wh-renew] collected=${r.collected} renewed=${r.renewed} failed=${r.failed} batches=${r.batches} ms=${r.ms} ${r.error ? 'error=' + r.error : ''}`,
        );
        break;
      }
      case CRON_ORDER_RECONCILE: {
        const r = await reconcileCjOrders(env);
        console.log(
          `[cron:order-reconcile] checked=${r.checked} tracked=${r.tracked} completed=${r.completed} failures=${r.failures} ms=${r.ms} ${r.error ? 'error=' + r.error : ''}`,
        );
        break;
      }
      default:
        console.warn(`[cron] unknown cron expression: ${cron}`);
    }
  } catch (e) {
    console.error(
      `[cron] task ${cron} failed after ${Date.now() - t0}ms:`,
      e instanceof Error ? `${e.name}: ${e.message}` : e,
    );
  }
}
