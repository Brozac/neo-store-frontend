// GET /api/admin/search-products?q= — Phase I · phasei_search_products
// آخر 30 منتج / بحث بالعنوان أو ID — bare array
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.length > 200) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const r = await withDb((sql) => callFn(sql, 'phasei_search_products', [q]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  return NextResponse.json(r);
}
