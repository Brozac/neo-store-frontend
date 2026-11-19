// GET /api/orders/my-orders — Phase B (proxy → fallback: JWT نفس سر الباك)
// 401 بلا توكن · 403 توكن غالط · قائمة طلبات المستخدم + status_label.
// ملاحظة: دور rw ما عندو وصول للـ users — الإيميل كيتقرا من الـ JWT نفسو
// (نفس الـ payload اللي كيصيفطو login/social) — نتيجة مطابقة.
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';
import { pbExtractToken, pbCsrfOk, pbGetStatusLabel } from '@/lib/pb/pb-secure-checkout';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1) proxy
  const proxied = await pbProxy(request, '/api/orders/my-orders');
  if (proxied) return proxied;

  // 2) fallback أصلي
  try {
    const { token, viaCookie } = pbExtractToken(request);
    if (!token) {
      return NextResponse.json({ message: 'Access Denied: No token provided' }, { status: 401 });
    }
    if (!pbCsrfOk(request, viaCookie)) {
      return NextResponse.json({ message: 'Forbidden origin' }, { status: 403 });
    }
    const jwtSecret = await getPbJwtSecret();
    if (!jwtSecret) return NextResponse.json({ error: 'Server error' }, { status: 500 });
    const user = await pbVerifyJwt(token, jwtSecret);
    if (!user) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 403 });
    }

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const userEmail = typeof user.email === 'string' ? user.email : null;
    const rows = await sql.unsafe(
      `SELECT * FROM orders
       WHERE user_id = $1 OR (customer_email = $2 AND status != 'pending')
       ORDER BY id DESC`,
      [user.id ?? null, userEmail],
    );
    const withLabels = rows.map((order) => ({ ...order, status_label: pbGetStatusLabel(order.status) }));
    return NextResponse.json(withLabels);
  } catch (e) {
    // 🛡️ بلا صمت — درس 2026-11-19
    console.warn('[pb-orders] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
