// GET /api/products/by-ids — F107 (proxy → fallback: db-ro) — المفضلة — server.js:3146
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbProductsByIds } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';


// 🩹 F107.1 — retry وحدة (cross-request promise pollution + cold-start roulette)
async function withRetry<T>(fn: () => Promise<T | undefined>): Promise<T | undefined> {
  const first = await fn().catch(() => undefined);
  if (first !== undefined) return first;
  await new Promise((r) => setTimeout(r, 120));
  return fn().catch(() => undefined);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const proxied = await pbProxy(request, '/api/products/by-ids' + url.search);
  if (proxied) return proxied;
  try {
    const rows = await withRetry(() => dbProductsByIds(url.searchParams.get('ids') || ''));
    if (rows !== undefined) {
      return NextResponse.json(rows, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-by-ids] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
