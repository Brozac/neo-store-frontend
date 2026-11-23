// ═══════════════════════════════════════════════════════════════
// Laclarc — open-next.config.ts (MIGRATION-CF v1.2.1 — KV-BUDGET-2)
// ═══════════════════════════════════════════════════════════════
// 🔴 F#94 (2026-11-23) — KV انفجر الخط الأحمر: kvIncrementalCache كان كيكتب
//   الكاطوغ كامل فـ KV — 158,683 مفتاح (3,787 فـ 13 نونبر = ×42 فـ 10 أيام) ·
//   تقدير ~20GB (الخط الأحمر 850MB = ×24 فوقو) · 3 مفاتيح لكل منتج
//   (صفحة ISR + fetch /api/products/:id + fetch /related — 158,683/54,367 = 2.92)
//   بلا TTL (SWR سنة فالـ headers + مفاتيح بلا انتهاء) → كلفة ~$10/شهر خفية.
//
// ✅ الحل v1.2 — صفر ISR/fetch cache: كل الـ ISR/fetch = miss → render حي
//   (بيانات فرش دايماً — freshness أحسن من 24h). الـ edge cache (s-maxage=86400
//   + SWR) كيبقى شغال فوقو كيف ما كان — MISS→HIT بلا أي تغيير فالـ headers.
//   الكلفة الحدية: render على كل edge-miss (~50ms CPU — الـ HITs تاع الحافة
//   ما كيوصلوش للـ Worker أصلاً). tagCache (D1) + queue (DO) بقوا كما هما.
//
// 🔧 v1.2.1 (2026-11-23) — "dummy" النصية كتوقع فـ bug ديال validation فـ
//   @opennextjs/cloudflare 1.20.13 (النسخة المقفولة فالـ lock): ensure-cf-config
//   فالشرط dftMaybeUseTagCache كيفحص `typeof incrementalCache === "function"`
//   بلاصة tagCache → config صحيح كيترفض ("should have a default export like
//   this") والبيلد يموت 18:18Z. البديل: no-op LazyLoadedOverride (function) —
//   مكافئة 100% للـ "dummy" الـ built-in (get = miss دائماً · set/delete no-op
//   = صفر I/O فـ KV) — والـ validator كيدوز بصراحة، بلا dangerousDisableConfigValidation.
//
// 📋 الأثر على KV: الصفر كتابة صفر قراءة — الـ binding تحيد على NS جديد فارغ
//   (laclarc-inc-cache-v2 · 3f3af1a3... — شوف wrangler.jsonc). الـ NS القديم
//   NEXT_INC_CACHE_KV (c56988e5...) فيه ~20GB كاش قديم — المالك يحيدو من
//   الداشبورد: Storage & Databases → KV → NEXT_INC_CACHE_KV → Delete.
//   (تحقق قبل الترحيل: sitecfg:v1 [F#93] كان 404 في القديم — خاوي أصلاً،
//   والموقع كيرجع للـ DEFAULT fail-soft — صفر خسارة بيانات.)
//
// ─── التاريخ v1.1 (KV edition): الفرضية كانت "ISR-BUDGET — كتابة غير عند
//   إعادة التوليد (1/يوم/منتج)". الواقع: أول زيارة لكل صفحة من الكروالر/جوجل
//   على كاطوغ 54K كتكتب 3 مفاتيح بلا انتهاء → التراكم ما عندو سقف عملي.
//   v1.2 كيقفل الباب من الجذره · v1.2.1 كيحل احتكاك الـ validator.
//
// ملاحظة معمارية: الصور unoptimized (OSS transforms في lib/imageOptimizer.ts)
//   → صفر استهلاك CPU ديال الصور على الـ Worker — كما هو.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  // 🔴 F#94 KV-BUDGET-2 — no-op cache: بلا أي كتابة/قراءة ISR/fetch فـ KV.
  //   الـ edge cache (s-maxage) هو طبقة الكاش الرسمية الوحيدة.
  incrementalCache: async () => ({
    name: "noop-incremental-cache-f94",
    get: async () => null,
    set: async () => {},
    delete: async () => {},
  }),
  queue: doQueue,
  tagCache: d1NextTagCache,
});
