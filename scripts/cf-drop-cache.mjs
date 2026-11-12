// ═══════════════════════════════════════════════════════════════
// F#67 cf-go — تخطي تعمير كاش ISR فالديبلوي (كوتا KV: 1000 كتابة/يوم → خطأ 10048)
// ═══════════════════════════════════════════════════════════════
// علاش؟ `opennextjs-cloudflare deploy` (v1.20.13) كيدير populateCache قبل رفع
// الـ Worker: كيقرا .open-next/cache/** (الصفحات المولّدة فالبناء) وكيعمّرهم
// فـ KV بـ "kv bulk put" — بآلاف الصفحات كيحرق الكوتا اليومية (1000 كتابة)
// والديبلوي كيموت بـ 10048 قبل ما الـ Worker يت deploys حتى.
//
// الحل: نخوي .open-next/cache → getCacheAssets() كيلقى 0 assets → populate
// كيتخطى براسو ("No cache assets to populate") → الديبلوي كيكمل عادي.
// (النسخة 1.20.13 ماعندهاش --skipPopulate — وهاد الحل خدّام مع أي نسخة.)
//
// ما كنخسرو والو: كاش ISR كيتعمّر دابا بكسل (lazy) من أول طلب حقيقي:
//   1) الحافة (Workers Cache, cache.enabled) — بلا كوتا
//   2) KV (kvIncrementalCache) — كتابة وحدة لكل URL فكل 24 ساعة، وفشلها
//      مسكود بـ try/catch (غير log — الصفحة كتزال كتخدم عادي)
import { rmSync, existsSync } from "node:fs";

if (existsSync(".open-next/cache")) {
	rmSync(".open-next/cache", { recursive: true, force: true });
	console.log("[cf-drop-cache] .open-next/cache تخوّى → populateCache غادي يخطي (0 assets) → الديبلوي بلا كتابة KV");
} else {
	console.log("[cf-drop-cache] .open-next/cache راه خاوي أصلاً — ماكاين مايتخوى");
}
