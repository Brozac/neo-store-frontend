// ═══════════════════════════════════════════════════════════════════════
// custom-worker.ts — الـ entry الجديد للـ worker (phase-abc — البند 8 من الـ audit)
// ═══════════════════════════════════════════════════════════════════════
// ليش؟ OpenNext كيبني .open-next/worker.js بـ fetch فقط — ما فيهش scheduled.
// هادا الغلاف الرسمي (نفس نمط وثائق @opennextjs/cloudflare):
//   · fetch  → نفس سلوك اليوم حرفياً (صفر تغيير على مسار الموقع)
//   · scheduled → المرسل الثلاثي:
//       "0 3 * * *"    → feeds (merchant-feed.xml + -usd → MEDIA_BUCKET)
//       "0 */6 * * *"  → runDailyPriceSync(25) — دورة عادلة بـ updated_at ASC
//       "0 * * * *"    → sweeper — إلغاء الطلبات الميتة (Stripe/Crypto 2h · BaridiMob 48h)
//
// ⚠️ لا تغير طريقة الاستيراد — .open-next/worker.js كيتولد قبل الـ bundling
//    (cf:deploy = cf-build.mjs ثم opennextjs-cloudflare deploy → wrangler كيجمع
//    هاد الملف بعد ما .open-next موجودة).
// ═══════════════════════════════════════════════════════════════════════
import worker from './.open-next/worker.js';
import { runScheduledTask } from './lib/cron-runner';

// 🔑 إجباري — الـ Durable Object تاع طابور الـ revalidate خاصو يتصدّر من نفس
// الـ entrypoint (درس حي من dry-run: "Your Worker depends on the following
// Durable Objects, which are not exported in your entrypoint file").
// .open-next/worker.js كيصدّرو — نعادوا هنا حرفياً.
export { DOQueueHandler } from './.open-next/worker.js';

interface OpenNextWorkerLike {
  fetch: (req: Request, env: CfCronEnv, ctx: WorkerCtxLike) => Promise<Response>;
}

const openNext = worker as OpenNextWorkerLike;

const laclarcWorker = {
  async fetch(
    request: Request,
    env: CfCronEnv,
    ctx: WorkerCtxLike,
  ): Promise<Response> {
    // نفس المسار حرفياً — كل منطق الموقع داخل OpenNext (routes API وكل شيء)
    return openNext.fetch(request, env, ctx);
  },

  async scheduled(
    controller: CronControllerLike,
    env: CfCronEnv,
    ctx: WorkerCtxLike,
  ): Promise<void> {
    // 🌉 جسر السرّات → process.env — مسارات الـ cron كتقرأ process.env.CJ_API_KEY
    //    إلخ (cjFetch/lib-*). خارج OpenNext الـ process.env ما كيتم-populateش تلقائياً.
    //    (مع nodejs_compat مفعل، CF كيعمر process.env — هادا احتياط مضاعف بلا ضرر.)
    try {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string' && value && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      // noop — الـ cron كيمشي حسب الـ paths اللي كتجيب من env مباشرة
    }
    // المعالجة كاملة داخل waitUntil — الـ invocation ما كيتسدش قبل السلامة
    ctx.waitUntil(runScheduledTask(controller.cron, env));
  },
};

export default laclarcWorker;
