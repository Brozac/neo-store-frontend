// GET /api/admin/track/[id] — Phase I: بروكسي CJ GET /logistic/trackInfo?trackNumber=
// العقد الحي المثبت: data=[] على رقم غير معروف — bare array pass-through
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const { id } = await params;
  const trackNumber = decodeURIComponent(id).trim().slice(0, 64);
  if (!trackNumber) {
    return NextResponse.json({ error: 'tracking number required' }, { status: 400 });
  }

  try {
    const res = await cjFetch('/logistic/trackInfo', { query: { trackNumber } });
    const env = res.data;
    if (!env || env.code !== 200) {
      return NextResponse.json(
        { error: env?.message || 'Tracking unavailable' },
        { status: 502 },
      );
    }
    return NextResponse.json(Array.isArray(env.data) ? env.data : []);
  } catch (e) {
    console.warn('[admin-track] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to query CJ logistics network.' }, { status: 502 });
  }
}
