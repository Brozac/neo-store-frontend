// lib/db-ro.ts — F106 HYPERDRIVE-RO — اتصال قراءة-فقط للكاتالوغ عبر Hyperdrive
// ═══════════════════════════════════════════════════════════════════════
// الهدف: صفحات ISR (المنتج/المرتبطون/القائمة/الكونفيگ/sitemap) كتولي كتجيب
// من Supabase نيشان عبر Hyperdrive — Render يطيح، الكاتالوگ يبقى حي.
//
// سلسلة المصادر (أول وحدة متوفرة تكسب):
//   1) env.HYPERDRIVE.connectionString  ← إنتاج (Worker + binding في wrangler.jsonc)
//   2) DIRECT_DATABASE_URL              ← محلي/CI (نفس دور laclarc_ro، بلا Hyperdrive)
//   3) null                             ← ما كاين والو → المنادي كيرجع للـ API الباك
//
// 🔒 الأمان: الدور laclarc_ro في Supabase = SELECT فقط على products /
//    store_settings / categories (بوليسيات RLS ro_select_*). أي كتابة
//    من هنا مستحيلة على مستوى الداتابيز — حتى إلا تسربت الكونكصيون.
//
// ⚠️ prepare:false — إجباري مع poolers (Supavisor) + Workers (منفصلات
//    Hyperdrive كتعاد استخدامها بين isolate-ات — بلا prepared statements).
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';

// shape مختصر لـ postgres.js Sql — بلا import types وقت الكومپايل
export interface RoSql {
  unsafe(query: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

let cachedSql: RoSql | null | undefined; // undefined = محاولناش، null = غير متوفر

async function resolveConnectionString(): Promise<string | null> {
  // ─── 1) Hyperdrive binding (إنتاج — نفس نمط siteConfigStore) ───
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const hd = env?.HYPERDRIVE as { connectionString?: string } | undefined;
    if (hd && typeof hd.connectionString === 'string' && hd.connectionString) {
      return hd.connectionString;
    }
  } catch {
    // ما كاينش context (next build على CI / wrangler dev بلا binding) — عادي
  }
  // ─── 2) fallback محلي (نفس الدور laclarc_ro — بلا Hyperdrive) ───
  return process.env.DIRECT_DATABASE_URL || null;
}

/**
 * كيرجع sql client للقراءة، ولا null إلا ما كاينش لا Hyperdrive لا
 * DIRECT_DATABASE_URL. النتيجة كتخزن مرة وحدة لكل isolate.
 */
export async function getRoSql(): Promise<RoSql | null> {
  if (cachedSql !== undefined) return cachedSql;
  try {
    const cs = await resolveConnectionString();
    if (!cs) {
      cachedSql = null;
      return null;
    }
    const { default: postgres } = await import('postgres');
    cachedSql = postgres(cs, {
      max: 5,
      // 🚀 PERF 2026-11-24: ~20k اتصال جديد فالنافذة = type-info 16.5k × 374 صف
      //    (pg_stat_statements). idle_timeout 30s كيقتل الاتصال بين الطلبات —
      //    300s + max_lifetime 3600 = إعادة استخدام داخل الـ isolate أقل connect+type-info.
      //    fetch_types يبقى true (عقد text[]: images/colors/sizes — موثق تحت).
      idle_timeout: 300,
      max_lifetime: 3600,
      connect_timeout: 8,
      // poolers + Workers: بلا server-side prepared statements
      prepare: false,
      // ⚠️ fetch_types يبقى default (true) — مثبت بالاختبار الحي (f106 diag):
      //    بلاه أعمدة text[] (images/colors/sizes/patterns) كيرجعو كسلاسل
      //    "{a,b}" بدل arrays — shape drift ضد الـ API (node-pg كيفكها arrays).
      //    التكلفة: query وحدة ديال type-info لكل connection جديد — Hyperdrive
      //    كيعاد استخدام المنفصلات فالتكلفة ~صفر.
    }) as unknown as RoSql;
    console.log('[db-ro] ready — read-only catalog via Hyperdrive/DIRECT');
  } catch (e) {
    // 🛡️ بلا صمت — الفشل كيتسجل والمنادي كيرجع للـ API الباك (سلوك اليوم)
    console.warn('[db-ro] init failed — API fallback stays active:',
      e instanceof Error ? e.message : e);
    cachedSql = null;
  }
  return cachedSql;
}
