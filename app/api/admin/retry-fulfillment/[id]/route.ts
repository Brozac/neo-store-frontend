// PUT /api/admin/retry-fulfillment/[id] — Phase I · phasei_retry_fulfillment
// manual→paid ثم كرون */15 reconcile كيجمعو (الآلة الموجودة — بلا تكرار)
// 409 على already_booked / exchange_order / bad_status (سلبي دلالي)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn, statusFor } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const r = await withDb((sql) => callFn(sql, 'phasei_retry_fulfillment', [orderId]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error, status: r.status }, { status: statusFor(r) });
  }
  return NextResponse.json({
    ok: true,
    message: String(r.message ?? 'Order fulfillment retry initiated in background!'),
  });
}
