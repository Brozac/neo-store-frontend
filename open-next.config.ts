// ═══════════════════════════════════════════════════════════════
// Laclarc — open-next.config.ts (MIGRATION-CF v1)
// ═══════════════════════════════════════════════════════════════
// الكاشينغ حسب دوك OpenNext الرسمية — وصفة "الموقع الصغير بالـ revalidation":
//   incrementalCache → R2  (الصفحات المولّدة: /products/[id], /categories, sitemaps)
//   queue            → DO  (إعادة التوليد الزمني revalidate=86400)
//   tagCache         → D1  (revalidateTag فـ /api/revalidate webhook)
//
// ملاحظة معمارية: الصور unoptimized (OSS transforms في lib/imageOptimizer.ts)
// → صفر استهلاك CPU ديال الصور على الـ Worker — أفضل حالة ممكنة للمجاني.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
