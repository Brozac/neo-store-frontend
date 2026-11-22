// POST /api/admin/merge/match — Phase I: بروكسي CJ /shopping/mergeOrder/autoMatchMergeOrderListV3
// العقد الحي: بلا نتائج → data STRING ("Congratulation!...") → نطبعوها {data:{result:[]}}
// مع نتائج → أول array field (result/mergeOrderList/list) → {data:{result:[...]}}
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const res = await cjFetch('/shopping/mergeOrder/autoMatchMergeOrderListV3', {
      method: 'POST',
      body: { filterOrder: true, orderStatus: 100 },
    });
    const env = res.data;
    if (!env || env.code !== 200) {
      return NextResponse.json(
        { error: env?.message || 'Merge matching unavailable' },
        { status: 502 },
      );
    }
    const d = env.data;
    if (typeof d === 'string') {
      // V3 quirk — بلا نتائج: رسالة نجاح كنص
      return NextResponse.json({ data: { result: [] } });
    }
    if (d && typeof d === 'object') {
      const obj = d as Record<string, unknown>;
      const arrKey = ['result', 'mergeOrderList', 'list', 'orderList'].find(
        (k) => Array.isArray(obj[k]),
      );
      return NextResponse.json({ data: { result: arrKey ? obj[arrKey] : [] } });
    }
    return NextResponse.json({ data: { result: [] } });
  } catch (e) {
    console.warn('[admin-merge-match] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Merge matching failed' }, { status: 502 });
  }
}
