// PUT /api/admin/update-category/[id] — Phase I · phasei_set_product_category
// {category: slugPath} — bad_category → 400
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
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0 || pid > 2_000_000_000) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { category?: unknown };
  const category = String(body.category ?? '').trim().slice(0, 300);
  if (!category) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const r = await withDb((sql) => callFn(sql, 'phasei_set_product_category', [pid, category]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, id: r.id, category: r.category });
}
