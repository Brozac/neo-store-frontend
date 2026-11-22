// POST /api/admin/auto-categorize — Phase I · phasei_auto_categorize(500)
// خطوتين داخل الدالة: cj_category_id → مسار الشجرة · keyword rules — {message} للوحة
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const r = await withDb((sql) => callFn(sql, 'phasei_auto_categorize', [500]));
  if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    message: `Auto-categorization done — matched by CJ tree: ${r.by_cj_id}, matched by keywords: ${r.by_keywords}.`,
  });
}
