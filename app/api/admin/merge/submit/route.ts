// POST /api/admin/merge/submit — Phase I: بروكسي CJ /shopping/mergeOrder/submitMergeOrderBatchV3
// الرد envelope {code,message} — panel: res.data.code === 200 || 0
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body) || body.length === 0) {
    // نفس شكل اللوحة: payload = shopOrders array (ولا group object)
    return NextResponse.json({ error: 'merge payload (array) required' }, { status: 400 });
  }

  try {
    const res = await cjFetch('/shopping/mergeOrder/submitMergeOrderBatchV3', {
      method: 'POST',
      body,
    });
    const env = res.data;
    if (!env) {
      return NextResponse.json({ error: 'Merge submit unavailable' }, { status: 502 });
    }
    return NextResponse.json(env, { status: env.code === 200 || env.code === 0 ? 200 : 502 });
  } catch (e) {
    console.warn('[admin-merge-submit] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Merge failed' }, { status: 502 });
  }
}
