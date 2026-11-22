// PUT /api/admin/update-product/[id] — Phase I · phasei_update_product
// حراس الدالة: price floor 9.99 · original > price · title required → 400
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn, statusFor } from '@/lib/admin-db';
import { parseProductPayload } from '@/lib/admin-product';

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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const p = parseProductPayload(body);

  const r = await withDb((sql) =>
    callFn(sql, 'phasei_update_product', [
      pid, p.title, p.price, p.original, p.image_url, p.images,
      p.description, p.material, p.colors, p.sizes, p.category,
    ]),
  );
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error, floor: r.floor }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, id: r.id });
}
