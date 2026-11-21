// POST /api/review/invite/[orderId] — Phase F (مرآة الأصلي): token-gated، مرة وحدة
// ذرياً فالـ SQL (FOR UPDATE + mark consumed) — نفس الردود حرفياً
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const id = parseInt(orderId, 10);
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const token = typeof body.token === 'string' ? body.token : '';
  const rating = parseInt(String(body.rating ?? ''), 10);
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const images = Array.isArray(body.images)
    ? (body.images as unknown[]).filter((u): u is string => typeof u === 'string').slice(0, 10)
    : [];

  if (!Number.isInteger(id) || id <= 0 || !UUID_RE.test(token)) {
    return NextResponse.json({ success: false, error: 'Invalid link' }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: 'Rating must be 1-5' }, { status: 400 });
  }
  if (content.length < 10) {
    return NextResponse.json(
      { success: false, error: 'Review must be at least 10 characters.' },
      { status: 400 },
    );
  }

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    const rows = await sql.unsafe('SELECT phasef_review_submit($1,$2,$3,$4,$5) AS r', [
      id,
      token,
      rating,
      content,
      images,
    ]);
    const v = rows[0]?.r as { ok?: boolean; error?: string; message?: string } | undefined;
    if (!v || v.ok !== true) {
      const err = v?.error || 'Link already used or invalid';
      return NextResponse.json({ success: false, error: err }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: v.message });
  } catch (e) {
    console.warn('[pb-review-submit] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
