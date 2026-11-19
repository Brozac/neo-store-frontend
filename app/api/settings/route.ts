// GET /api/settings — F107 (proxy → fallback: db-ro) — store_settings العمومية — server.js:3847
// dbSettings كتطبق نفس التحول: hidden_routes/hidden_sections قوائم، الباقي boolean.
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbSettings } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';


// 🩹 F107.1 — retry وحدة (cross-request promise pollution + cold-start roulette)
async function withRetry<T>(fn: () => Promise<T | undefined>): Promise<T | undefined> {
  const first = await fn().catch(() => undefined);
  if (first !== undefined) return first;
  await new Promise((r) => setTimeout(r, 120));
  return fn().catch(() => undefined);
}

export async function GET(request: Request) {
  const proxied = await pbProxy(request, '/api/settings');
  if (proxied) return proxied;
  try {
    const settings = await withRetry(() => dbSettings());
    if (settings !== undefined) return NextResponse.json(settings);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-settings] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
