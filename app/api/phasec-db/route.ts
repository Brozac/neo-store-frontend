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
import { sendEmail } from '@/lib/emails';
import { orderConfirmation, orderSubject, reviewInvite, type OrderEmailItem } from '@/lib/email-templates';

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
        const extra = params.extra && typeof params.extra === 'object' ? params.extra : null;
        await sql.unsafe(
          'SELECT public.phasec_exchange_booked($1, $2, $3, $4, $5) AS r',
          [orderId, cjNumber, chosenId, chosenTitle, extra],
        );
        return NextResponse.json({ ok: true });
      }

      // ─── Phase D: رقم CJ محروق (CJ_NUMBER_BURNED — نفس شكل الأصلي) ───
      case 'burn': {
        const orderId = Number(params.orderId);
        const base = String(params.base ?? '').slice(0, 64);
        const bump = Number(params.bump);
        const number = String(params.number ?? '').slice(0, 64);
        const reason = String(params.reason ?? 'unknown').slice(0, 128);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000
            || !base || !Number.isInteger(bump) || bump < 1) {
          return bad(400, 'bad params');
        }
        await sql.unsafe(
          'SELECT public.phasec_exchange_burn($1, $2, $3, $4, $5) AS r',
          [orderId, base, bump, number, reason],
        );
        return NextResponse.json({ ok: true });
      }

      // ─── Phase E: لقاء طلب للويبهوك (id من STORE-n / cj_id / tracking) ───
      case 'webhook_find_order': {
        const orderId = params.orderId == null ? null : Number(params.orderId);
        const cjId = String(params.cjId ?? '').slice(0, 64);
        const track = String(params.track ?? '').slice(0, 64);
        if (orderId !== null && (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000)) {
          return NextResponse.json({ ok: true, r: { code: 'not_found' } });
        }
        const rows = await sql.unsafe(
          'SELECT public.phasec_webhook_find_order($1, $2, $3) AS r',
          [orderId, cjId, track],
        );
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? { code: 'not_found' } });
      }

      // ─── Phase E: آلة حالات forward-only (SECURITY DEFINER) ───
      case 'webhook_mutate': {
        const orderId = Number(params.orderId);
        const action = String(params.action ?? '').slice(0, 32);
        const track = String(params.track ?? '').slice(0, 64);
        const cjId = String(params.cjId ?? '').slice(0, 64);
        const status = String(params.status ?? '').slice(0, 32);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
          return bad(400, 'bad orderId');
        }
        const rows = await sql.unsafe(
          'SELECT public.phasec_webhook_order_mutate($1, $2, $3, $4, $5) AS r',
          [orderId, action, track, cjId, status],
        );
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? { ok: false } });
      }

      // ─── Phase E: أرشفة حدث ويبهوك (أنواع [A-Z0-9_] فقط + تعقيم مفاتيح الأسرار فالـ SQL) ───
      case 'webhook_event': {
        const type = String(params.type ?? '').slice(0, 64);
        const orderId = params.orderId == null ? null : Number(params.orderId);
        const details = params.details && typeof params.details === 'object' ? params.details : {};
        const severity = String(params.severity ?? 'info').slice(0, 16);
        if (!/^[A-Z0-9_]{1,64}$/.test(type)) {
          return bad(400, 'bad event type');
        }
        if (orderId !== null && (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000)) {
          return bad(400, 'bad orderId');
        }
        await sql.unsafe(
          'SELECT public.phasec_webhook_event($1, $2, $3, $4) AS r',
          [type, orderId, details, severity],
        );
        return NextResponse.json({ ok: true });
      }

      // ─── Phase E: نبض الويبهوك (دوك CJ 3.3 — صف واحد id=1) ───
      case 'webhook_heartbeat': {
        const type = String(params.type ?? '').slice(0, 40);
        await sql.unsafe('SELECT public.phasec_webhook_heartbeat($1) AS r', [type]);
        return NextResponse.json({ ok: true });
      }

      case 'webhook_heartbeat_get': {
        const rows = await sql.unsafe('SELECT public.phasec_webhook_heartbeat_get() AS r');
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? { ok: false } });
      }

      // ─── Phase E-2: سياق CAPI/الدفع (SELECT مضيق — rw عنده SELECT على orders) ───
      // PII للـ Purchase (conversionService) + stripe_session_id للبوابة المالية API-level.
      // بلا أسرار — القيم تُستهلك فالـ Rust worker برك.
      case 'capi_context': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
          return NextResponse.json({ ok: true, r: null });
        }
        const rows = await sql.unsafe(
          `SELECT total_amount, customer_email, customer_phone, customer_name, customer_city,
                  utm_source, utm_campaign, click_id, stripe_session_id, payment_method
             FROM orders WHERE id = $1 LIMIT 1`,
          [orderId],
        );
        return NextResponse.json({ ok: true, r: rows[0] ?? null });
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

      // ─── Phase F: الحجز العادي (E10 Reconcile) ───
      case 'regular_cj_context': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2_000_000_000) {
          return NextResponse.json({ ok: true, ctx: { code: 'bad_order' } });
        }
        const rows = await sql.unsafe('SELECT phasef_regular_cj_context($1) AS r', [orderId]);
        return NextResponse.json({ ok: true, ctx: rows[0]?.r ?? { code: 'order_not_found' } });
      }
      case 'regular_booked': {
        const orderId = Number(params.orderId);
        const number = String(params.number ?? '');
        const extra = (params.extra as Record<string, unknown>) ?? {};
        if (!Number.isInteger(orderId) || orderId <= 0) return bad(400, 'Bad orderId');
        const rows = await sql.unsafe('SELECT phasef_regular_booked($1,$2,$3::jsonb) AS r', [
          orderId,
          number.slice(0, 64),
          JSON.stringify(extra),
        ]);
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? null });
      }
      case 'regular_defer': {
        const orderId = Number(params.orderId);
        const reason = String(params.reason ?? 'unknown').slice(0, 64);
        const details = (params.details as Record<string, unknown>) ?? {};
        if (!Number.isInteger(orderId) || orderId <= 0) return bad(400, 'Bad orderId');
        const rows = await sql.unsafe('SELECT phasef_regular_defer($1,$2,$3::jsonb) AS r', [
          orderId,
          reason,
          JSON.stringify(details),
        ]);
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? null });
      }
      case 'reconcile_pick': {
        const rows = await sql.unsafe('SELECT phasef_reconcile_pick($1) AS r', [5]);
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? [] });
      }
      case 'review_invite_pick': {
        const rows = await sql.unsafe('SELECT phasef_review_invite_pick() AS r');
        return NextResponse.json({ ok: true, r: rows[0]?.r ?? [] });
      }
      case 'review_invite_mark': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0) return bad(400, 'Bad orderId');
        await sql.unsafe('SELECT phasef_review_invite_mark($1) AS r', [orderId]);
        return NextResponse.json({ ok: true });
      }

      // ─── Phase F: الإيميلات من الـ cron (قوالب SERENE عبر الجسر) ───
      case 'email_confirm': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0) return bad(400, 'Bad orderId');
        const oRows = await sql.unsafe(
          `SELECT id, order_number, total_amount, customer_email, customer_name
             FROM orders WHERE id = $1 LIMIT 1`,
          [orderId],
        );
        const o = oRows[0] as
          | { id: number; order_number: string | null; total_amount: string | number;
              customer_email: string | null; customer_name: string | null }
          | undefined;
        if (!o) return NextResponse.json({ ok: true, sent: false, reason: 'order_missing' });
        const email = String(o.customer_email ?? '');
        if (!email || email.includes('@laclarc.com')) {
          return NextResponse.json({ ok: true, sent: false, reason: 'email_guard' });
        }
        const iRows = await sql.unsafe(
          `SELECT oi.quantity, oi.price_at_purchase, p.title, p.image_url
             FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1 ORDER BY oi.id`,
          [orderId],
        );
        await sendEmail({
          to: email,
          subject: orderSubject(o.order_number, o.id),
          html: orderConfirmation({
            orderId: o.id,
            orderNumber: o.order_number ?? undefined,
            total: String(o.total_amount),
            items: iRows as unknown as OrderEmailItem[],
            customerName: o.customer_name ?? undefined,
          }),
        });
        return NextResponse.json({ ok: true, sent: true });
      }
      case 'email_review_invite': {
        const orderId = Number(params.orderId);
        if (!Number.isInteger(orderId) || orderId <= 0) return bad(400, 'Bad orderId');
        const oRows = await sql.unsafe(
          `SELECT id, order_number, customer_name, customer_email, review_token
             FROM orders WHERE id = $1 LIMIT 1`,
          [orderId],
        );
        const o = oRows[0] as
          | { id: number; order_number: string | null; customer_name: string | null;
              customer_email: string | null; review_token: string | null }
          | undefined;
        if (!o || !o.review_token || !o.customer_email) {
          return NextResponse.json({ ok: true, sent: false, reason: 'missing' });
        }
        if (o.customer_email.includes('@laclarc.com')) {
          return NextResponse.json({ ok: true, sent: false, reason: 'email_guard' });
        }
        const iRows = await sql.unsafe(
          `SELECT p.title, p.image_url FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1 ORDER BY oi.id LIMIT 1`,
          [orderId],
        );
        const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://laclarc.com';
        await sendEmail({
          to: o.customer_email,
          subject: 'How was your order? Get 5% off your next one ⭐',
          html: reviewInvite({
            customerName: o.customer_name ?? undefined,
            orderId: o.id,
            orderNumber: o.order_number ?? undefined,
            reviewUrl: `${site}/review/${o.id}?t=${o.review_token}`,
            product: { image_url: ((iRows[0] as { image_url?: string | null } | undefined)?.image_url ?? undefined) },
          }),
        });
        return NextResponse.json({ ok: true, sent: true });
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
