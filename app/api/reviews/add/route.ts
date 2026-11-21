// POST /api/reviews/add — Phase F (مرآة الأصلي): JWT إجباري + صور Cloudinary فقط
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbRequireUser } from '@/lib/pb/pb-user';
import { pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await pbRequireUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Access Denied: No token provided' },
        { status: 401 },
      );
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Product ID and content are required' }, { status: 400 });
    }
    const productId = parseInt(String(body.product_id ?? ''), 10);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!Number.isInteger(productId) || productId <= 0 || !content) {
      return NextResponse.json({ error: 'Product ID and content are required' }, { status: 400 });
    }

    // 🩹 FIX#8 — صور Cloudinary فقط (نفس الفلتر الأصلي)
    const images = Array.isArray(body.images)
      ? (body.images as unknown[]).filter(
          (u): u is string => typeof u === 'string' && u.startsWith('https://res.cloudinary.com/'),
        )
      : [];
    // 🩹 FIX#9 — rating clamp
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const country = typeof body.country === 'string' && body.country ? body.country : 'United States';

    void pbClientIp(request); // keep import used — limiter exists for future tightening

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error saving review' }, { status: 500 });

    const res = await sql.unsafe(
      'SELECT phasef_review_add($1,$2,$3,$4,$5,$6,$7,$8) AS r',
      [productId, user.name ?? 'Customer', user.id, rating, content, country, images, true],
    );
    const ok = (res[0]?.r as { ok?: boolean } | undefined)?.ok === true;
    if (!ok) return NextResponse.json({ error: 'Server error saving review' }, { status: 500 });

    return NextResponse.json(
      { message: 'Verified review with photos added successfully!' },
      { status: 201 },
    );
  } catch (e) {
    console.warn('[pb-review-add] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error saving review' }, { status: 500 });
  }
}
