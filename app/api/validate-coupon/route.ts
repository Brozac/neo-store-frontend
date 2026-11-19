// POST /api/validate-coupon — Phase B (proxy → fallback: نفس couponHelper)
// 400 invalid request · 404 invalid/expired · 200 {discount,newTotal,message}
// الحجز الذري (used_count) نفس الباك — fail-closed دايماً.
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbApplyCouponToTotal } from '@/lib/pb/pb-secure-checkout';
import { pbRateLimit, pbClientIp, PB_LIMITS, PB_LIMIT_MESSAGES } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // البودي مرة وحدة — stream كيتستهلك
  const rawBody = await request.text().catch(() => '');

  // 1) proxy
  const proxied = await pbProxy(request, '/api/validate-coupon', rawBody);
  if (proxied) return proxied;

  // 2) fallback أصلي
  try {
    if (!pbRateLimit(`coupon:${pbClientIp(request)}`, PB_LIMITS.coupon.max, PB_LIMITS.coupon.windowMs)) {
      return NextResponse.json({ error: PB_LIMIT_MESSAGES.coupon }, { status: 429 });
    }
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(rawBody || '{}') as Record<string, unknown>; } catch { body = {}; }
    const code = body.code;
    const cartTotal = body.cartTotal;
    if (!code || typeof cartTotal !== 'number' || cartTotal < 0) {
      return NextResponse.json({ error: 'Invalid coupon request' }, { status: 400 });
    }

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const { applied, discount, total } = await pbApplyCouponToTotal(sql, code, cartTotal);
    if (!applied) {
      return NextResponse.json({ error: 'Invalid or expired coupon code.' }, { status: 404 });
    }

    return NextResponse.json({
      discount: discount.toFixed(2),
      newTotal: total.toFixed(2),
      message: `Coupon applied! You saved $${discount.toFixed(2)}`,
    });
  } catch (e) {
    // 🛡️ بلا صمت — درس 2026-11-19
    console.warn('[pb-coupon] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
