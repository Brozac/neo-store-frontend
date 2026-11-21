// GET /api/review/verify/[orderId]?t= — Phase F (مرآة الأصلي): token-gated، عام
// 400 Invalid link · 404 Link invalid · 409 Review already submitted · 400 not delivered
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const id = parseInt(orderId, 10);
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!Number.isInteger(id) || id <= 0 || !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }
  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'internal' }, { status: 500 });
    const rows = await sql.unsafe('SELECT phasef_review_verify($1,$2) AS r', [id, token]);
    const v = rows[0]?.r as
      | { code: string; orderId?: number; customerName?: string; items?: unknown[]; status?: string }
      | null
      | undefined;
    if (!v) return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    if (v.code === 'not_found') return NextResponse.json({ error: 'Link invalid' }, { status: 404 });
    if (v.code === 'submitted')
      return NextResponse.json({ error: 'Review already submitted' }, { status: 409 });
    if (v.code === 'not_delivered')
      return NextResponse.json({ error: 'Order not delivered yet' }, { status: 400 });
    if (v.code !== 'ok') return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    return NextResponse.json({
      orderId: v.orderId,
      customerName: v.customerName,
      items: v.items ?? [],
    });
  } catch (e) {
    console.warn('[pb-review-verify] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
