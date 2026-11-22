// GET /api/admin/failed-orders — Phase I · phasei_failed_orders_list
// أطابور الإنقاذ: paid بلا رقم CJ بلا exchange_token — bare array
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const r = await withDb((sql) => callFn(sql, 'phasei_failed_orders_list', []));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  return NextResponse.json(r);
}
