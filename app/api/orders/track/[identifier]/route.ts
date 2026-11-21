// GET /api/orders/track/[identifier]?email= — Phase F (مرآة الأصلي v1.1)
// الإيميل إجباري دائماً + email match (IDOR مقفول) — نفس SAFE_COLUMNS
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    if (!pbRateLimit(`track:${pbClientIp(request)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }
    const { identifier } = await params;
    const email = new URL(request.url).searchParams.get('email') || '';
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email is required for shipment verification' },
        { status: 400 },
      );
    }
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    const rows = await sql.unsafe('SELECT phasef_track_order($1,$2) AS r', [
      identifier,
      email.trim().toLowerCase(),
    ]);
    const list = rows[0]?.r as unknown[] | null;
    if (!list || list.length === 0) {
      return NextResponse.json(
        { error: 'No orders found matching this Order ID and Email combination.' },
        { status: 404 },
      );
    }
    return NextResponse.json(list);
  } catch (e) {
    console.warn('[pb-track] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
