// GET /api/payment/gateways — Phase B (proxy → fallback: payment_gateways من DB)
// نفس الباك: fail-closed — خطأ DB = { enabled: [] } (ماشي كل البوابات!)
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';

export const dynamic = 'force-dynamic';

let gwCache: { keys: string[]; expiry: number } | null = null;

export async function GET(request: Request) {
  // 1) proxy — Render حي = نفس السلوك حرفياً
  const proxied = await pbProxy(request, '/api/payment/gateways');
  if (proxied) return proxied;

  // 2) fallback أصلي — payment_gateways من Supabase (laclarc_rw SELECT)
  try {
    const now = Date.now();
    if (gwCache && now < gwCache.expiry) {
      return NextResponse.json({ enabled: gwCache.keys });
    }
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ enabled: [] });
    const rows = await sql.unsafe(
      'SELECT gateway_key, enabled FROM payment_gateways ORDER BY id ASC',
    );
    const keys = rows.filter((r) => r.enabled).map((r) => String(r.gateway_key));
    gwCache = { keys, expiry: now + 30000 }; // 30s — نفس الباك
    return NextResponse.json({ enabled: keys });
  } catch {
    return NextResponse.json({ enabled: [] }); // fail-closed
  }
}
