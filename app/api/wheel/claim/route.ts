// POST /api/wheel/claim — Phase B (proxy → fallback: نسبة server-side + JWT موقّع)
// نفس الباك (B-M4b): النسبة كتتولد سيرفر-سايد بتوزيع مرجّح — قيمة الكلاينت تتجاهل.
// الـ token كيتوقع بنفس سر الباك (HS256, 24h) — التحقق كيتم عند الـ checkout.
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { pbSignWheelJwt, getPbJwtSecret } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp, PB_LIMITS, PB_LIMIT_MESSAGES } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

const WEIGHTED = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 7, 10, 15];

export async function POST(request: Request) {
  // 1) proxy
  const proxied = await pbProxy(request, '/api/wheel/claim');
  if (proxied) return proxied;

  // 2) fallback أصلي
  try {
    if (!pbRateLimit(`wheel:${pbClientIp(request)}`, PB_LIMITS.wheel.max, PB_LIMITS.wheel.windowMs)) {
      return NextResponse.json({ error: PB_LIMIT_MESSAGES.wheel }, { status: 429 });
    }
    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const pct = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
    const wheelToken = await pbSignWheelJwt(pct, secret);
    return NextResponse.json({ pct, wheelToken });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
