// GET /api/track/[trackNumber] — Phase F (مرآة الأصلي): CJ trackInfo حي
import { NextResponse } from 'next/server';
import { cjFetch } from '@/lib/cf-cj';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackNumber: string }> },
) {
  try {
    if (!pbRateLimit(`tracknum:${pbClientIp(request)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }
    const { trackNumber } = await params;
    const clean = trackNumber.trim().slice(0, 64);
    if (!clean) return NextResponse.json({ error: 'No tracking info found.' }, { status: 404 });

    const res = await cjFetch('logistic/trackInfo', { query: { trackNumber: clean } });
    if (res.data && res.data.code === 200) {
      return NextResponse.json(res.data.data ?? {});
    }
    return NextResponse.json({ error: 'No tracking info found.' }, { status: 404 });
  } catch (e) {
    console.warn('[pb-track-info] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
