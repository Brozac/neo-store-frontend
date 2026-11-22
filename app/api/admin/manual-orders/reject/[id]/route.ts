// PUT /api/admin/manual-orders/reject/[id] — Phase I · phasei_manual_reject
// سبب الإلغاء إجباري (audit trail) — نفس العقد
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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = String(body.reason ?? '').slice(0, 300);
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }

  const r = await withDb((sql) => callFn(sql, 'phasei_manual_reject', [orderId, reason]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error, status: r.status }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, message: String(r.message ?? 'Order rejected') });
}
