// POST /api/admin/sourcing/create — Phase I: بروكسي CJ /product/sourcing/create
// طلب شراء مباشر للوكلاء (1688 sourcing) — envelope pass-through
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const productName = String(body.productName ?? '').trim().slice(0, 300);
  const productImage = String(body.productImage ?? body.product_image ?? '').trim().slice(0, 1000);
  if (!productName || !productImage) {
    return NextResponse.json({ error: 'productName and productImage are required' }, { status: 400 });
  }

  const payload = {
    productName,
    productImage,
    productUrl: String(body.productUrl ?? body.product_url ?? '').slice(0, 1000),
    price: Number(body.price) || 0,
  };

  try {
    const res = await cjFetch('/product/sourcing/create', { method: 'POST', body: payload });
    const env = res.data;
    if (!env) {
      return NextResponse.json({ error: 'Sourcing unavailable' }, { status: 502 });
    }
    return NextResponse.json(env, { status: env.code === 200 ? 200 : 502 });
  } catch (e) {
    console.warn('[admin-sourcing] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Sourcing request failed' }, { status: 502 });
  }
}
