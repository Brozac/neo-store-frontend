// POST /api/admin/cogs — Phase I: بروكسي CJ /shopping/order/queryCogsBasicDataOrderInfoList
// العقد الحي: {orderCodesList:[...]} → data (array|null) — panel: res.data.data[0]
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { orderCodes?: unknown };
  const codes = Array.isArray(body.orderCodes)
    ? body.orderCodes.map((c) => String(c).trim().slice(0, 64)).filter(Boolean).slice(0, 20)
    : [];
  if (codes.length === 0) {
    return NextResponse.json({ error: 'orderCodes required' }, { status: 400 });
  }

  try {
    const res = await cjFetch('/shopping/order/queryCogsBasicDataOrderInfoList', {
      method: 'POST',
      body: { orderCodesList: codes },
    });
    const env = res.data;
    if (!env || env.code !== 200) {
      return NextResponse.json(
        { error: env?.message || 'COGS unavailable' },
        { status: 502 },
      );
    }
    return NextResponse.json({ code: env.code, data: env.data ?? null });
  } catch (e) {
    console.warn('[admin-cogs] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'COGS fetch failed' }, { status: 502 });
  }
}
