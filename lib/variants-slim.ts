// lib/variants-slim.ts — phase-abc: تنحيف variants وقت الكتابة (البند 4/SQL cleanup)
// ═══════════════════════════════════════════════════════════════════════
// التدقيق الحي (2026-11-23): كل variant = payload خام CJ بـ 23 مفتاح منها
// inventories 100% — الفرونت/الشيكاوت كيستهلكو 5 مفاتيح فقط:
//   vid            → مطابقة الشيكاوت + swatches + PDP (lib/pb/pb-secure-checkout.ts:107)
//   variantKey     → مجموعات الألوان/المقاسات + فاسيتات + swatches (SQL بـ ->>'variantKey')
//   variantImage   → المعرض + swatches (526/526 معمّرين)
//   variantNameEn  → fallback ديال variantKey (ProductDetailsClient.tsx:654)
//   variantSellPrice→ تسعير الشيكاوت من DB (pb-secure-checkout.ts:111) — 53,460 منتج
// كلشي آخر (inventories · barcode · weight · createTime ...) كيتحيد وقت الكتابة.
// القراءة الحية (cj-live) كتجيب inventories من CJ API مباشرة — ما كتقراش من DB.
// ═══════════════════════════════════════════════════════════════════════

/** المفاتيح المحفوظة في التخزين — المستهلكون الفعليون فقط */
export const VARIANT_KEEP_KEYS = [
  'vid',
  'variantKey',
  'variantImage',
  'variantNameEn',
  'variantSellPrice',
] as const;

export type SlimVariant = Partial<Record<(typeof VARIANT_KEEP_KEYS)[number], unknown>>;

/**
 * كتنحيف array تاع variants من CJ قبل الكتابة في DB.
 * كتضمن:vid/variantKey/variantImage كيبقاو كما هو · الباقي المفاتيح الجانبية تتحيد.
 * كترجع [] إلا الدخل ماشي array. الحد الأقصى للسلامة: 100 variant (نفس sync routes).
 */
export function slimVariantsForStorage(raw: unknown, max = 100): SlimVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: SlimVariant[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const src = item as Record<string, unknown>;
    const slim: Record<string, unknown> = {};
    let kept = 0;
    for (const key of VARIANT_KEEP_KEYS) {
      const v = src[key];
      if (v === undefined) continue;
      slim[key] = v;
      kept++;
    }
    // variant بلا vid وبلا variantKey = مافيهش فايدة للفرونت ولا للشيكاوت — يتخطّى
    if (kept === 0) continue;
    if (slim.vid === undefined && slim.variantKey === undefined) continue;
    out.push(slim as SlimVariant);
  }
  return out;
}

/**
 * SQL strip للقراءة (PDP) — يطبق فوق عمود variants القديم قبل ما الـ SQL الوحيد
 * يجري على الداتا الحية (البند 4 — نفس المقترح المُعتمد فالـ audit).
 * الاستعمال: dbProduct في lib/db-reads.ts كيبدل 'variants' بهادا في قائمة الأعمدة.
 */
export const PDP_VARIANTS_STRIP_SQL =
  "COALESCE((SELECT jsonb_agg(v - 'inventories') " +
  "FROM jsonb_array_elements(CASE WHEN jsonb_typeof(variants) = 'array' THEN variants ELSE '[]'::jsonb END) v " +
  "), '[]'::jsonb) AS variants";

/** SQL تنحيف التخزين (كما هو — مرة وحدة) — نفس المجموعة الآمنة للـ backfill */
export const SLIM_STORAGE_SQL = `
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vid',            v -> 'vid',
        'variantKey',     v -> 'variantKey',
        'variantImage',   v -> 'variantImage',
        'variantNameEn',  v -> 'variantNameEn',
        'variantSellPrice', v -> 'variantSellPrice'
      )
    ), '[]'::jsonb)`;
