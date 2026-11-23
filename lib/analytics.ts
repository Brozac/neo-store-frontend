// lib/analytics.ts — phase-abc: Analytics Engine — أحداث عالية التردد (البند 9)
// ═══════════════════════════════════════════════════════════════════════
// Workers Paid مفعّل حياً (تأكيد subscriptions 2026-11-24) → STORE_ANALYTICS
// binding = writeDataPoint — صفر صفوف في Supabase (البند 9 كيمنع INSERT).
//
// العقود:
//   · fail-open دائماً: بلا binding/بلا سياق = noop — ما كيكسرش أي مسار
//   · writeDataPoint كيتصل مرة وحدة لكل isolate من الذاكرة (الـ dataset
//     كيتولد أوتوماتيكياً عند أول نقطة)
//   · الحقول: index1 = نوع الحدث · blobs = [productId?, q?, path?] — قصيرة
//     ومقطوعة (حد Analytics: 96KB/طلب لكن نستعمل ≤ ~200B)
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getPbRuntime } from '@/lib/pb/pb-env';

export const ANALYTICS_TYPES = [
  'product_view',
  'add_to_cart',
  'checkout_start',
  'search',
  'utm_visit',
] as const;

export type AnalyticsType = (typeof ANALYTICS_TYPES)[number];

export function isAnalyticsType(v: unknown): v is AnalyticsType {
  return typeof v === 'string' && (ANALYTICS_TYPES as readonly string[]).includes(v);
}

function cut(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : '';
}

/**
 * كتابة نقطة أناليتكس — آمنة للمنادين من أي سياق (fetch cron webhooks).
 * `datasetOverride` للكرون (env مباشر) — اختياري.
 */
export async function writeAnalyticsEvent(
  type: AnalyticsType,
  fields: { productId?: number; query?: string; path?: string; utm?: string } = {},
  datasetOverride?: AnalyticsDatasetLike | null,
): Promise<boolean> {
  try {
    let dataset = datasetOverride ?? null;
    if (!dataset) {
      const { env } = await getPbRuntime();
      dataset = (env.STORE_ANALYTICS as AnalyticsDatasetLike | undefined) ?? null;
    }
    if (!dataset || typeof dataset.writeDataPoint !== 'function') return false;

    const index1 = type; // الفلترة الرئيسية في الاستعلامات
    const blobs: (string | number | null)[] = [
      fields.productId ?? null,
      cut(fields.query, 120),
      cut(fields.path, 160),
      cut(fields.utm, 120),
      Date.now(),
    ];
    dataset.writeDataPoint(blobs, [index1]);
    return true;
  } catch {
    return false; // fail-open — الأناليتكس ما كيكسرش السيرفر
  }
}
