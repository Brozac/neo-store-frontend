// GET /api/search?q= — F107 (proxy → fallback: db-ro) — سقف 5 — server.js:2534
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbSearch } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const proxied = await pbProxy(request, '/api/search' + url.search);
  if (proxied) return proxied;
  try {
    const rows = await dbSearch(url.searchParams.get('q') || '');
    if (rows !== undefined) return NextResponse.json(rows);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-search] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
