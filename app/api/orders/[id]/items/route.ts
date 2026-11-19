// GET /api/orders/[id]/items — Phase B (proxy → fallback: حماية IDOR نفس الباك)
// 404 Order not found · 403 ماشي المالك · قائمة بنود الطلب.
// المالك = JWT user_id ولا email query param (case-insensitive).
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';
import { pbExtractToken } from '@/lib/pb/pb-secure-checkout';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // 1) proxy (نفس path بالضبط)
  const proxied = await pbProxy(request, `/api/orders/${encodeURIComponent(id)}/items${new URL(request.url).search}`);
  if (proxied) return proxied;

  // 2) fallback أصلي
  try {
    const email = new URL(request.url).searchParams.get('email');

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const orderRes = await sql.unsafe(
      'SELECT customer_email, user_id FROM orders WHERE id = $1',
      [id],
    );
    if (orderRes.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderRes[0];

    // المستخدم الاختياري (JWT)
    let jwtUser: { id?: number } | null = null;
    const { token } = pbExtractToken(request);
    if (token) {
      const jwtSecret = await getPbJwtSecret();
      if (jwtSecret) {
        const user = await pbVerifyJwt(token, jwtSecret);
        if (user && typeof user.id === 'number') jwtUser = { id: user.id };
      }
    }

    const isOwner =
      (jwtUser && order.user_id === jwtUser.id) ||
      (email && String(order.customer_email ?? '').toLowerCase() === email.toLowerCase());

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to view these items.' },
        { status: 403 },
      );
    }

    const items = await sql.unsafe(
      `SELECT oi.quantity, oi.price_at_purchase, p.title, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id],
    );
    return NextResponse.json(items);
  } catch (e) {
    // 🛡️ بلا صمت — درس 2026-11-19
    console.warn('[pb-orders] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
