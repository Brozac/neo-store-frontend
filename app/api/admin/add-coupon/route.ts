// POST /api/admin/add-coupon — Phase I · phasei_add_coupon
// حراس الدالة: code regex · percentage ≤ 90 · fixed ≤ 1000 · duplicate → 400
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn, statusFor } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? '').trim().toUpperCase().slice(0, 40);
  const type = String(body.discount_type ?? '').trim().toLowerCase();
  const value = Number(body.discount_value);
  if (!code) return NextResponse.json({ error: 'bad_code' }, { status: 400 });

  const r = await withDb((sql) => callFn(sql, 'phasei_add_coupon', [code, type, value]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, code: r.code, message: 'Coupon activated successfully!' });
}
