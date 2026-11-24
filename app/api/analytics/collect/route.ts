// POST /api/analytics/collect — phase-abc: beacon endpoint (البند 9)
// ═══════════════════════════════════════════════════════════════════════
// الأحداث عالية التردد (product_view · add_to_cart · utm_visit) من الـ client
// كتوصّل هنا بـ sendBeacon/fetch keepalive → writeDataPoint في Analytics Engine
// (STORE_ANALYTICS) — صفر صفوف في Supabase، صفر انتظار، صفر كسر للمسار.
//
// · no-store صريح (middleware كيغطي /api/* غير الكاطالوگ — هنا احتياط مزدوج)
// · 204 دائماً بعد التحقق — الـ client ما كيتسناش
// · القائمة المسموحة: ANALYTICS_TYPES — ما كاينش INSERT في DB
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { writeAnalyticsEvent, isAnalyticsType } from '@/lib/analytics';
import { getPbRuntime } from '@/lib/pb/pb-env';
import { refreshPriceOnVisit } from '@/lib/price-sync';

export const dynamic = 'force-dynamic';

interface BeaconBody {
  type?: unknown;
  productId?: unknown;
  query?: unknown;
  path?: unknown;
  utm?: unknown;
}

export async function POST(request: Request) {
  const res = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });

  let body: BeaconBody;
  try {
    body = (await request.json()) as BeaconBody;
  } catch {
    return res; // payload فاسد — صمت (beacon ما كيتشخصش)
  }

  if (!isAnalyticsType(body.type)) return res;

  const productId =
    typeof body.productId === 'number' && Number.isFinite(body.productId) && body.productId > 0
      ? Math.floor(body.productId)
      : undefined;

  // fire — الرد راجع قبل الكتابة (waitUntil داخل writeAnalyticsEvent عبر getPbRuntime)
  void writeAnalyticsEvent(body.type, {
    productId,
    query: typeof body.query === 'string' ? body.query : undefined,
    path: typeof body.path === 'string' ? body.path : undefined,
    utm: typeof body.utm === 'string' ? body.utm : undefined,
  });

  // 🚀 PERF goal-4 — SWR ديال الثمن عند الزيارة: product_view = تحديث CJ محتمل
  //    fire-and-forget (عينة 10% + قاطع دائرة + guard updated_at) — 204 كيرجع دغيا.
  if (body.type === 'product_view' && productId) {
    try {
      const rt = await getPbRuntime();
      rt.waitUntil(refreshPriceOnVisit(
        productId,
        rt.env as unknown as Parameters<typeof refreshPriceOnVisit>[1],
      ));
    } catch {
      // بلا runtime context (محلي/build) — تخطى بصمت
    }
  }
  return res;
}
