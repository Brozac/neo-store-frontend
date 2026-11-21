// app/api/phasec-db/route.ts — Phase C: جسر DB للـ Rust worker (laclarc-api)
// ═══════════════════════════════════════════════════════════════════
// المسار: Rust worker (rpc.laclarc.com) → هاد الجسر → Supabase عبر
// postgres.js بدور laclarc_rw (نفس نمط Phase B المثبت حياً).
//
// 🛡️ الأمان:
//   - X-PhaseC-Key يجب أن يطابق env.PHASEC_BRIDGE_KEY (64-hex) وإلا 404 صامت
//   - البيانات كلها معلّمة مسبقاً في الـ Rust worker — هنا تحقق ثانٍ (defense in depth)
//   - كل عمليات الكتابة عبر دوال SECURITY DEFINER مضيقة (phasec_*) — ما كاينش SQL حرة
//   - بلا مفتاح في البيئة → المسار كامل inert (404) — deployment آمن قبل التسريبات
//
// ⚠️ ما كاينش DELETE/INSERT/UPDATE حرة هنا — غير SELECT مباشر على
//    system_events/store_settings/orders + استدعاء الدوال المضيقة.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BridgeBody {
  action?: string;
  params?: Record<string, unknown>;
}

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  // ─── 1. الحارس: المفتاح المشترك ───
  const key = (process.env.PHASEC_BRIDGE_KEY || '').trim();
  if (!key) {
    return bad(404, 'Not found'); // مسار inert — ما تسربش حتى وجودو
  }
  const provided = req.headers.get('x-phasec-key') || '';
  if (provided !== key) {
    return bad(404, 'Not found');
  }

  // ─── 2. الشكل ───
  let body: BridgeBody;
  try {
    body = await req.json();
  } catch {
    return bad(400, 'Invalid JSON body');
  }
  const { action, params = {} } = body;
  if (!action || typeof action !== 'string') {
    return bad(400, 'action required');
  }

  const sql = await getRwSql();
  if (!sql) {
    return bad(502, 'DB unavailable');
  }

  try {
    switch (action) {
      // ─── قراءة خيارات exchange (SELECT مضيق — rw عنده SELECT على orders) ───
      case 'exchange_options': {
        const orderId = Number(params.orderId);
        const token = String(params.token || '');
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000 || !UUID_RE.test(token)) {
          return NextResponse.json({ ok: true, row: null });
        }
        const rows = await sql.unsafe(
          'SELECT status, exchange_options, cj_order_number FROM orders WHERE id = $1 AND exchange_token = $2::uuid LIMIT 1',
          [orderId, token],
        );
        return NextResponse.json({ ok: true, row: rows[0] ?? null });
      }

      // ─── المعاملة الذرية (دالة SECURITY DEFINER) ───
      case 'exchange_pick': {
        const orderId = Number(params.orderId);
        const token = String(params.token || '');
        const pick = String(params.pick ?? '');
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000 || !UUID_RE.test(token)) {
          return NextResponse.json({ ok: true, data: { r: { code: 'already_picked' } } });
        }
        if (pick.length > 256) {
          return NextResponse.json({ ok: true, data: { r: { code: 'internal' } } });
        }
        const rows = await sql.unsafe(
          'SELECT public.phasec_exchange_pick($1, $2, $3) AS r',
          [orderId, token, pick],
        );
        return NextResponse.json({ ok: true, data: rows[0] ?? { r: { code: 'internal' } } });
      }

      // ─── الخلفية المؤجلة: تسجيل تأجيل الحجز (Phase D v2: سبب حقيقي) ───
      case 'exchange_defer': {
        const orderId = Number(params.orderId);
        const chosenId = String(params.chosenId ?? '').slice(0, 256);
        const chosenTitle = String(params.chosenTitle ?? '').slice(0, 500);
        const reason = String(params.reason ?? 'booking_deferred_phasec').slice(0, 128);
        const detail = params.detail && typeof params.detail === 'object' ? params.detail : null;
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
          return bad(400, 'bad orderId');
        }
        await sql.unsafe(
          'SELECT public.phasec_exchange_defer($1, $2, $3, $4, $5) AS r',
          [orderId, chosenId, chosenTitle, reason, detail],
        );
        return NextResponse.json({ ok: true });
      }

      // ─── Phase D: سياق حجز CJ (قراءة مضيقة عبر دالة SECURITY DEFINER) ───
      case 'cj_context': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
          return NextResponse.json({ ok: true, ctx: { code: 'bad_order' } });
        }
        const rows = await sql.unsafe(
          'SELECT public.phasec_exchange_cj_context($1) AS ctx',
          [orderId],
        );
        return NextResponse.json({ ok: true, ctx: rows[0]?.ctx ?? { code: 'bad_order' } });
      }

      // ─── Phase D: نجاح الحجز (cj_order_number + EXCHANGE_SUCCESS) ───
      case 'booked': {
        const orderId = Number(params.orderId);
        const cjNumber = String(params.cjNumber ?? '').trim().slice(0, 64);
        const chosenId = String(params.chosenId ?? '').slice(0, 256);
        const chosenTitle = String(params.chosenTitle ?? '').slice(0, 500);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000 || !cjNumber) {
          return bad(400, 'bad params');
        }
        await sql.unsafe(
          'SELECT public.phasec_exchange_booked($1, $2, $3, $4) AS r',
          [orderId, cjNumber, chosenId, chosenTitle],
        );
        return NextResponse.json({ ok: true });
      }

      // ─── سجل الأحداث ───
      case 'system_events': {
        const limit = Number(params.limit);
        const lim = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 200) : 50;
        const type = params.type;
        if (typeof type === 'string' && type.length > 0 && type.length <= 64) {
          const rows = await sql.unsafe(
            'SELECT id, event_type, order_id, details, severity, created_at FROM system_events WHERE event_type = $1 ORDER BY created_at DESC LIMIT $2',
            [type, lim],
          );
          return NextResponse.json({ ok: true, rows });
        }
        const rows = await sql.unsafe(
          'SELECT id, event_type, order_id, details, severity, created_at FROM system_events ORDER BY created_at DESC LIMIT $1',
          [lim],
        );
        return NextResponse.json({ ok: true, rows });
      }

      // ─── قراءة إعدادات الظهور ───
      case 'settings_get': {
        const rows = await sql.unsafe(
          "SELECT key, value FROM store_settings WHERE key = ANY($1::text[])",
          [['show_reels', 'hidden_routes', 'hidden_sections']],
        );
        return NextResponse.json({ ok: true, rows });
      }

      // ─── كتابة إعداد واحد (دالة SECURITY DEFINER بنفس القيود) ───
      case 'settings_put': {
        const key = String(params.key ?? '');
        const value = String(params.value ?? '');
        if (!/^[a-z0-9_]{1,64}$/.test(key) || value.length > 10000) {
          return bad(400, 'Invalid setting');
        }
        const rows = await sql.unsafe(
          'SELECT public.phasec_set_setting($1, $2) AS r',
          [key, value],
        );
        return NextResponse.json({ ok: true, data: rows[0] ?? null });
      }

      default:
        return bad(400, 'Unknown action');
    }
  } catch (err: unknown) {
    console.warn('[phasec-db] action failed:', action, (err as Error)?.message);
    return bad(500, 'DB error');
  } finally {
    // إغلاق مؤجل — نفس نمط pb-db (end() خلال waitUntil كان كيكسر الpool)
    try {
      await sql.end({ timeout: 5 });
    } catch { /* idle_timeout backstop */ }
  }
}
