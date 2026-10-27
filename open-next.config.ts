// ═══════════════════════════════════════════════════════════════
// Laclarc — open-next.config.ts (MIGRATION-CF v1.1 — KV edition)
// ═══════════════════════════════════════════════════════════════
// الكاشينغ حسب دوك OpenNext الرسمية — وصفة "الموقع الصغير بالـ revalidation":
//   incrementalCache → KV  (الصفحات المولّدة: /products/[id], /categories, sitemaps)
//   queue            → DO  (إعادة التوليد الزمني revalidate=86400)
//   tagCache         → D1  (revalidateTag فـ /api/revalidate webhook)
//
// علاش KV ماشي R2؟ R2 كيتطلب تفعيل بالكارت من الداشبورد — KV يخدم مباشرة
// وبلا كارت، وفي حدود المجاني (1GB + 100K قراءة/يوم + 1K كتابة/يوم)
// أوسع بزاف من حاجتنا: ISR-BUDGET كيكتب غير عند إعادة التوليد (ويب هوك
// + revalidate 24h). الاتساق النهائي (eventual consistency) ما يضرش:
// التأخير ثواني والصفحات كتعاود تتبنى كل 24 ساعة.
// ملاحظة معمارية: الصور unoptimized (OSS transforms في lib/imageOptimizer.ts)
// → صفر استهلاك CPU ديال الصور على الـ Worker — أفضل حالة ممكنة للمجاني.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
