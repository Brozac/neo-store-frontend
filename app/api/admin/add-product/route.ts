// POST /api/admin/add-product — Phase I · phasei_add_product
// نفس حراس update-product (price floor 9.99 · title required) → 400
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn, statusFor } from '@/lib/admin-db';
import { parseProductPayload } from '@/lib/admin-product';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const p = parseProductPayload(body);

  const r = await withDb((sql) =>
    callFn(sql, 'phasei_add_product', [
      p.title, p.price, p.original, p.image_url, p.images,
      p.description, p.material, p.colors, p.sizes, p.category,
    ]),
  );
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error, floor: r.floor }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, id: r.id });
}
