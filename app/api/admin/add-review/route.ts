// POST /api/admin/add-review — Phase I · phasef_review_add (reuse ذكي — GRANT واجد)
// ريفيو موثّق من اللوحة — verified=true (نفس سلوك الباك القديم)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn, statusFor } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const productId = Number(body.product_id);
  const author = String(body.author ?? '').trim().slice(0, 120);
  const rating = Math.round(Number(body.rating));
  const content = String(body.content ?? '').trim().slice(0, 2000);
  if (!Number.isInteger(productId) || productId <= 0 || !author || !content) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'bad_rating' }, { status: 400 });
  }

  const r = await withDb((sql) =>
    callFn(sql, 'phasef_review_add', [productId, author, null, rating, content, null, null, true]),
  );
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: statusFor(r) });
  }
  return NextResponse.json({ ok: true, message: 'Review added successfully!' });
}
