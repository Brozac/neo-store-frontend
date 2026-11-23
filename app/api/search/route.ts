// GET /api/search?q= — F107 (proxy → fallback: db-ro) — سقف 5 — server.js:2534
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbSearch } from '@/lib/db-reads';
import { writeAnalyticsEvent } from '@/lib/analytics';

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
  const proxied = await pbProxy(request, '/api/search' + url.search);
  if (proxied) return proxied;
  try {
    const qRaw = url.searchParams.get('q') || '';
    const rows = await withRetry(() => dbSearch(qRaw));
    // 🆕 phase-abc — analytics (search → STORE_ANALYTICS، بلا DB) — صمت عند الفشل
    if (rows !== undefined && qRaw.trim()) {
      void writeAnalyticsEvent('search', { query: qRaw.trim() });
    }
    if (rows !== undefined) return NextResponse.json(rows);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-search] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
