// GET /api/products/deals — F107 (proxy → fallback: db-ro) — server.js:3170
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbDeals } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await pbProxy(request, '/api/products/deals');
  if (proxied) return proxied;
  try {
    const rows = await dbDeals();
    if (rows !== undefined) {
      return NextResponse.json(rows, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-deals] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
