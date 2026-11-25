// GET /feeds/[file] — phase-abc: خدمة الـ merchant feeds من R2 (البند 6)
// ═══════════════════════════════════════════════════════════════════════
// رابط Google Merchant Center المستقر:
//   https://laclarc.com/feeds/merchant-feed.xml       (DZD كما هو في DB)
//   https://laclarc.com/feeds/merchant-feed-usd.xml   (USD — تحويل حي)
//
// · القراءة من MEDIA_BUCKET (laclarc-media) — الرفع اليومي من cron 3:00 UTC
// · سماحية صارمة: ملفين فقط — كل حاجة أخرى = 404 (بلا traversal ولا تكهن)
// · الكاش: s-maxage=21600 (6h — الجديد كيوصل 3:00 كيتنشر قبل ما ينقضي) +
//   stale-while-revalidate=86400 — الـ zone cache (cache.enabled) كيفحص الكاش
//   قبل الـ Worker (نفس الصفحات ISR) — HIT = صفر قراءة R2
// · middleware ما كي no-store-يش غير /api/* — هادا المسار يخس الكاش عادي
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { getPbRuntime } from '@/lib/pb/pb-env';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['merchant-feed.xml', 'merchant-feed-usd.xml']);
const R2_PREFIX = 'feeds/';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  if (!ALLOWED.has(file)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { env } = await getPbRuntime();
  const bucket = env.MEDIA_BUCKET as R2BucketLike | undefined;
  if (!bucket || typeof bucket.get !== 'function') {
    return NextResponse.json({ error: 'Media storage unavailable' }, { status: 503 });
  }

  try {
    const obj = await bucket.get(R2_PREFIX + file);
    if (!obj) {
      // الـ feed ماشي مولد بعد — دليل واضح للمالك
      return NextResponse.json(
        { error: 'Feed not generated yet — run POST /api/admin/build-feeds or wait for the 03:00 UTC cron' },
        { status: 404 },
      );
    }
    // 🩹 streaming-fix (2026-11-25): obj.body (ReadableStream) مباشرة — arrayBuffer()
    // كان كيفري الـ feed كامل (~117MB) فذاكرة الـ Worker (سقف ~128MB) → OOM/1102
    // ملي Googlebot كيجي يجبد الـ feed. الـ streaming كيدوز بالبايتات بلا
    // buffering — الذاكرة O(1) مهما كبر الـ feed، و TTFB كيطير (أول chunk دغيا).
    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // الحجم الدقيق من R2 — Googlebot كيتعامل معاه أحسن من chunked،
        // وكيخلي الـ zone cache يخدم بلا تخمين (size اختياري فالنوع → حارس).
        ...(typeof obj.size === 'number'
          ? { 'Content-Length': String(obj.size) }
          : {}),
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
        ...(obj.customMetadata?.generated_at
          ? { 'X-Feed-Generated-At': obj.customMetadata.generated_at }
          : {}),
      },
    });
  } catch (e) {
    console.warn('[feeds] R2 get failed:',
      e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Storage error' }, { status: 503 });
  }
}
