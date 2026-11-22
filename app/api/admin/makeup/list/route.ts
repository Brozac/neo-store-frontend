// GET /api/admin/makeup/list — Phase I: بروكسي CJ POST /shopping/makeup/list
// العقد الحي: data.pageData.content — pass-through مع {data} wrapper (panel عقد ثابت)
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const res = await cjFetch('/shopping/makeup/list', {
      method: 'POST',
      body: { pageNum: 1, pageSize: 20, type: 0 },
    });
    const env = res.data;
    if (!env || env.code !== 200) {
      return NextResponse.json(
        { error: env?.message || 'CJ makeup unavailable' },
        { status: 502 },
      );
    }
    return NextResponse.json({ data: env.data ?? null });
  } catch (e) {
    console.warn('[admin-makeup] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Error fetching CJ makeup payments.' }, { status: 502 });
  }
}
