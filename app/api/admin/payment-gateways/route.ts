// GET/PATCH /api/admin/payment-gateways — Phase I · البوابات
// GET = SELECT مباشر (laclarc_rw عنده SELECT على payment_gateways — مثبت فالـ grants)
// PATCH /[key] = phasei_gateway_toggle (حرس last_enabled_gateway)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const rows = await withDb((sql) =>
    sql.unsafe('SELECT gateway_key, display_name, enabled FROM payment_gateways ORDER BY id ASC'),
  );
  if (rows === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  // PATCH بدون مفتاح — غير مسموح (المسار الصحيح /[key])
  return NextResponse.json({ error: 'gateway key required' }, { status: 405 });
}
