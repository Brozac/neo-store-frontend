// GET /api/settings — F107 (proxy → fallback: db-ro) — store_settings العمومية — server.js:3847
// dbSettings كتطبق نفس التحول: hidden_routes/hidden_sections قوائم، الباقي boolean.
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { dbSettings } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await pbProxy(request, '/api/settings');
  if (proxied) return proxied;
  try {
    const settings = await dbSettings();
    if (settings !== undefined) return NextResponse.json(settings);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } catch (e) {
    console.warn('[pb-settings] fallback failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
