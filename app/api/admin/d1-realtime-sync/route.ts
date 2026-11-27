// POST /api/admin/d1-realtime-sync — 100% D1 — الكتابة الحية من PostgreSQL المحلي
// ═════════════════════════════════════════════════════════════════════
// المنادي: scripts/realtime-d1-watcher.mjs (PM2 على الـ PC المحلي) — كيسمع
// NOTIFY d1_sync_channel (triggers في scripts/pg-triggers-d1-sync.sql) وكيطرش:
//   { op: 'INSERT' | 'UPDATE' | 'DELETE', id: number, row?: {...} }
//
// 🔒 auth: x-admin-password vs سرّ ADMIN_PASSWORD — مقارنة timing-safe
//    (sha256 + timingSafeEqual — بلا تسريب طول ولا محتوى). بلا كوكي ولا
//    جلسة — هادا مسار machine-to-machine من الـ PC للـ Worker.
//
// INSERT/UPDATE → upsert products (lib/d1.ts — whitelist أعمدة) + purge
// DELETE        → حذف من D1 + purge
// purge = revalidateTag (ISR) + zone purge (debounced) + KV version bump
//         (debounced) — كل طبقة fail-open.
//
// ⚠️ بلا binding DB → 503 صريح: "جري scripts/laclarc-d1-windows.ps1" —
//    الـ watcher كيعاود المحاولة، والـ deploy ما يتكسرش قبل التفعيل.
// ═════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'node:crypto';
import {
  getD1,
  d1UpsertProduct,
  d1DeleteProduct,
  d1LogEvent,
} from '@/lib/d1';
import { purgeEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';

/** sha256 + timingSafeEqual — حتى تسريب الطول ما كاين (hash بطول ثابت). */
function authOk(req: Request): boolean {
  const expected = (process.env.ADMIN_PASSWORD || '').trim();
  const got = (req.headers.get('x-admin-password') || '').trim();
  if (!expected || !got) return false;
  try {
    const a = createHash('sha256').update(expected).digest();
    const b = createHash('sha256').update(got).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const bad = (msg: string, status = 400) =>
  NextResponse.json({ ok: false, error: msg }, { status });

export async function POST(req: Request) {
  if (!authOk(req)) {
    return bad('Unauthorized', 401);
  }

  const db = await getD1();
  if (!db) {
    return bad(
      'D1 binding missing — run scripts/laclarc-d1-windows.ps1 (activates "DB" in wrangler.jsonc)',
      503,
    );
  }

  let body: { op?: string; id?: number | string; row?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad('invalid json body');
  }

  const op = String(body.op || '').toUpperCase();
  const id = Math.trunc(Number(body.id));
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return bad('invalid id');
  }

  const t0 = Date.now();
  try {
    if (op === 'DELETE') {
      const existed = await d1DeleteProduct(db, id);
      const purge = await purgeEdgeCache([id]);
      return NextResponse.json({ ok: true, op: 'DELETE', id, existed, purge, ms: Date.now() - t0 });
    }

    if (op === 'INSERT' || op === 'UPDATE' || op === 'UPSERT') {
      if (!body.row || typeof body.row !== 'object' || Array.isArray(body.row)) {
        return bad('row object required for INSERT/UPDATE');
      }
      const rowId = Math.trunc(Number((body.row as Record<string, unknown>).id ?? id));
      if (rowId !== id) return bad('row.id mismatch with body.id');
      await d1UpsertProduct(db, { ...(body.row as Record<string, unknown>), id });
      const purge = await purgeEdgeCache([id]);
      return NextResponse.json({ ok: true, op: 'UPSERT', id, purge, ms: Date.now() - t0 });
    }

    return bad('op must be INSERT|UPDATE|DELETE');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[d1-realtime-sync] failed:', e instanceof Error ? `${e.name}: ${e.message}` : e);
    // فشل كتابة → سجل فsystem_events (fail-open) — الـ watcher كيعاود من عندو
    try {
      await d1LogEvent(db, 'D1_SYNC_ERROR', { op, id, error: msg.slice(0, 300) }, 'error');
    } catch { /* noop */ }
    return bad('sync failed — check logs', 500);
  }
}

// GET ممنوع — الكتابة كتما عبر POST فقط (نفس عقد edge-cache-purge)
export async function GET() {
  return NextResponse.json({ ok: false, error: 'POST only' }, { status: 405 });
}
