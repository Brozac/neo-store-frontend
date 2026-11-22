// DELETE /api/admin/delete-product/[id] — Phase I · phasei_hide_product
// إخفاء من المتجر (بلا DELETE فعلي — SELFHEAL pattern) — الرد {ok:true,id}
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function DELETE(
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

  const r = await withDb((sql) => callFn(sql, 'phasei_hide_product', [pid]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: r.id });
}
