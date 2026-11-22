// POST /api/admin/disputes/create — Phase I: بروكسي CJ /disputes/create
// businessDisputeId إجباري عند CJ — يتولد LC-* هنا (نفس عقد الباك القديم)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = String(body.orderId ?? '').trim().slice(0, 64);
  const lineItemId = String(
    (body.productInfoList as { lineItemId?: string }[] | undefined)?.[0]?.lineItemId ?? '',
  ).trim().slice(0, 64);
  const messageText = String(body.messageText ?? '').slice(0, 2000);
  if (!orderId || !lineItemId || !messageText) {
    return NextResponse.json({ error: 'orderId, lineItemId and messageText are required' }, { status: 400 });
  }

  const businessDisputeId = `LC-${orderId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}-${Date.now().toString(36).toUpperCase()}`;
  const payload = {
    orderId,
    disputeReasonId: Number(body.disputeReasonId) || 1,
    expectType: Number(body.expectType) || 1,
    refundType: Number(body.refundType) || 1,
    messageText,
    businessDisputeId,
    productInfoList: [
      {
        lineItemId,
        quantity: Math.max(1, Math.round(Number((body.productInfoList as { quantity?: number }[] | undefined)?.[0]?.quantity) || 1)),
      },
    ],
  };

  try {
    const res = await cjFetch('/disputes/create', { method: 'POST', body: payload });
    const env = res.data;
    if (!env) {
      return NextResponse.json({ error: 'CJ dispute unavailable' }, { status: 502 });
    }
    return NextResponse.json(env, { status: env.code === 200 ? 200 : 502 });
  } catch (e) {
    console.warn('[admin-dispute-create] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to file dispute.' }, { status: 502 });
  }
}
