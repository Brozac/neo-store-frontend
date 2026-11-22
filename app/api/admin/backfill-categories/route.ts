// POST /api/admin/backfill-categories — Phase I · phasei_backfill_categories
// تحديث أقسام كل المنتجات الموجودة (statement واحد) — {ok,updated}
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const r = await withDb((sql) => callFn(sql, 'phasei_backfill_categories', []));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    message: `Backfill done — ${r.updated} products updated in background.`,
  });
}
