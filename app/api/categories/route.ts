// GET /api/categories — F107 (proxy → fallback: db-ro) — شجرة + صور — server.js:1578
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbCategoriesTree } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await pbProxy(request, '/api/categories');
  if (proxied) return proxied;
  try {
    const tree = await dbCategoriesTree();
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
}
