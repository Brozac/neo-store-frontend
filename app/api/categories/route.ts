// GET /api/categories — F107 (proxy → fallback: db-ro) — شجرة + صور — server.js:1578
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbCategoriesTree } from '@/lib/db-reads';
import { withEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';


// 🩹 F107.1 — retry وحدة (cross-request promise pollution + cold-start roulette)
async function withRetry<T>(fn: () => Promise<T | undefined>): Promise<T | undefined> {
  const first = await fn().catch(() => undefined);
  if (first !== undefined) return first;
  await new Promise((r) => setTimeout(r, 120));
  return fn().catch(() => undefined);
}

export async function GET(request: Request) {
  // Phase H — الكاش على حافة CF: الرد فيه s-maxage أصلاً = يتكاشا بيه نفسو
  return withEdgeCache(request, async () => {
    const proxied = await pbProxy(request, '/api/categories');
    if (proxied) return proxied;
    try {
      const tree = await withRetry(() => dbCategoriesTree());
      if (tree !== undefined) {
        return NextResponse.json(tree, {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
      }
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    } catch (e) {
      console.warn('[pb-categories] fallback failed:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}
