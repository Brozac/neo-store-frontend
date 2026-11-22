// PATCH /api/admin/payment-gateways/[key] — Phase I · phasei_gateway_toggle
// {enabled: boolean} إجباري — 400 آخر بوابة مفعلة (last_enabled_gateway)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const { key } = await params;
  const cleanKey = String(key ?? '').trim().slice(0, 64);
  if (!/^[a-z0-9_]{1,64}$/i.test(cleanKey)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 });
  }

  const r = await withDb((sql) =>
    callFn(sql, 'phasei_gateway_toggle', [cleanKey, body.enabled as boolean]),
  );
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    gateway_key: r.gateway_key,
    enabled: r.enabled,
  });
}
