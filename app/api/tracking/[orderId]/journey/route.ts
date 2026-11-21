// GET /api/tracking/[orderId]/journey?email= — Phase F (مرآة shipTruth.getJourney)
// DB events (shipment_events عبر phasef_journey) + مزامنة حية من CJ (trackInfo)
// IDOR: orderId + customerEmail — 403 على الاختلاف (نفس الأصلي)
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { cjFetch, type Rec } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

interface JourneyCtx {
  code: string;
  order?: { id: number; order_number: string | null; status: string; tracking: string | null; destination: string | null };
  defaultStage?: string;
  events?: Array<{ type: string; location: string | null; description: string | null; time: string | null }>;
  eta?: Record<string, unknown> | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const email = new URL(request.url).searchParams.get('email') || '';
    if (!orderId || !email) {
      return NextResponse.json({ error: 'orderId and email required' }, { status: 400 });
    }
    const id = parseInt(orderId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Order not found or email mismatch' }, { status: 403 });
    }
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Journey fetch failed' }, { status: 500 });
    const rows = await sql.unsafe('SELECT phasef_journey($1,$2) AS r', [id, email.trim()]);
    const ctx = rows[0]?.r as JourneyCtx | null | undefined;
    if (!ctx || ctx.code !== 'ok') {
      return NextResponse.json({ error: 'Order not found or email mismatch' }, { status: 403 });
    }

    // مزامنة حية — trackInfo من CJ (تدهور صامت — الرحلة التاريخية كتكمل)
    const events = [...(ctx.events ?? [])];
    let live: Rec | null = null;
    const tracking = ctx.order?.tracking || '';
    if (tracking) {
      try {
        const res = await cjFetch('logistic/trackInfo', { query: { trackNumber: tracking }, timeoutMs: 12000 });
        const d = res.data?.data as Rec | undefined;
        if (d) {
          // نفس شكل live الأصلي (دوك 2.1) — الحقول كلها اختيارية
          live = {
            status: typeof d.status === 'string' ? d.status : '',
            deliveryDay: typeof d.deliveryDay === 'string' ? d.deliveryDay : '',
            deliveryTime: typeof d.deliveryTime === 'string' ? d.deliveryTime : '',
            lastMileCarrier: typeof d.lastMileCarrier === 'string' ? d.lastMileCarrier : '',
            lastMileCarrierPhone: typeof d.lastMileCarrierPhone === 'string' ? d.lastMileCarrierPhone : '',
            lastMileCarrierEmail: typeof d.lastMileCarrierEmail === 'string' ? d.lastMileCarrierEmail : '',
            lastMileNumber: typeof d.lastMileNumber === 'string' ? d.lastMileNumber : '',
          };
          // أحداث حية تضاف للرحلة (بلا كتابة — القراءة فقط)
          const traces = Array.isArray(d.logisticTraces) ? (d.logisticTraces as Rec[]) : [];
          for (const t of traces.slice(0, 50)) {
            events.push({
              type: typeof t.traceType === 'string' ? t.traceType : 'TRACE',
              location: typeof t.location === 'string' ? t.location : null,
              description: typeof t.traceStatus === 'string' ? t.traceStatus : null,
              time: typeof t.time === 'string' ? t.time : null,
            });
          }
        }
      } catch (e) {
        console.warn('[pb-journey] live sync skipped:', e instanceof Error ? e.message : e);
      }
    }

    const currentStage = events.length
      ? (events[events.length - 1].type || ctx.defaultStage || '')
      : (ctx.defaultStage || ctx.order?.status || '');

    const payload: Record<string, unknown> = {
      order: ctx.order,
      currentStage,
      events,
      eta: ctx.eta ?? null,
      live,
      truthLevel: live ? 'live' : 'history',
    };
    const res = NextResponse.json(payload);
    // Edge caching للطلبات المسلّمة فقط (نفس الأصلي)
    if (currentStage === 'DELIVERED' || ctx.order?.status === 'completed') {
      res.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
    }
    return res;
  } catch (e) {
    console.warn('[pb-journey] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Journey fetch failed' }, { status: 500 });
  }
}
