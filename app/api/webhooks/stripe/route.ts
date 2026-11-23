// POST /api/webhooks/stripe — phase-abc: Stripe webhook محصّن في الـ worker (البند 7a)
// ═══════════════════════════════════════════════════════════════════════
// نقل حرفي من الباك القديم (server.js checkout.session.completed) + نمط
// verify-session الحي — نفس الجولة الذهبية:
//   1) توقيع HMAC-SHA256 (Web Crypto — مكافئة constructEventAsync) — fail-closed
//   2) رد 200 فوري { received: true } (Stripe كيقيس السرعة)
//   3) المعالجة كاملة داخل ctx.waitUntil:
//      · القفل الذري: UPDATE orders SET status='paid' WHERE id=$1 AND status='pending'
//        — واحد برك من (JIT / Webhook / Reconcile) كيربح — idempotent
//      · flip → pbFulfillRegularOrder (rpc = CJ + إيميلات — Phase F)
//      · charge.refunded → status='refunded' محكوم + سجل
//
// ⚙️ إعداد المالك (مرة وحدة):
//   wrangler secret put STRIPE_WEBHOOK_SECRET   (whsec_... من Stripe)
//   Stripe Dashboard → Developers → Webhooks → Add endpoint:
//     URL: https://laclarc.com/api/webhooks/stripe
//     Events: checkout.session.completed, charge.refunded
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/stripe-verify';
import { getPbRuntime, pbVar } from '@/lib/pb/pb-env';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbNormalizeEmail } from '@/lib/pb/pb-secure-checkout';
import { pbFulfillRegularOrder } from '@/lib/pb/pb-fulfill';

export const dynamic = 'force-dynamic';

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

/** المعالجة الخلفية — كل شيء fail-safe (فشلها ما كيأثرش على الـ 200) */
async function processStripeEvent(event: StripeEvent): Promise<void> {
  const type = String(event.type ?? '');
  const session = (event.data?.object ?? {}) as Record<string, unknown>;
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const orderId = Number.parseInt(String(metadata.orderId ?? ''), 10);

  const sql = await getRwSql();
  if (!sql) {
    console.warn('[wh-stripe] rw unavailable — event', type, 'order', orderId);
    return;
  }

  try {
    if (type === 'checkout.session.completed') {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        // 🛡️ metadata تالفة → تجاهل بنعومة (نفس الباك)
        await logEvent(sql, type, { note: 'bad_orderId_metadata', eventId: event.id });
        return;
      }
      if (session.payment_status !== undefined && session.payment_status !== 'paid') {
        // session غير مدفوع (نادر في completed) — لا نعتمد
        await logEvent(sql, type, { orderId, note: 'payment_status_not_paid' }, orderId);
        return;
      }

      // نفس التحولات حرفياً من verify-session (المصدر: session object من الحدث)
      const customerDetails = (session.customer_details ?? {}) as Record<string, unknown>;
      const collected = (session.collected_information ?? {}) as Record<string, unknown>;
      const shippingDetails = (collected.shipping_details ?? {}) as Record<string, unknown>;
      const customerName = (customerDetails.name as string) || 'Valued Customer';
      const customerEmail = pbNormalizeEmail(customerDetails.email);
      const customerPhone =
        (customerDetails.phone as string) ||
        (shippingDetails.phone as string) ||
        (collected.phone_number as string) ||
        '';
      const addr = customerDetails.address || shippingDetails.address || null;
      const shippingAddress = addr
        ? JSON.stringify(addr)
        : JSON.stringify({ line1: 'Online Store Purchase', country: 'US' });
      const paidAmount = Number(session.amount_total) / 100;

      // القفل الذري — نفس SQL ديال verify-session حرفياً
      const updateRes = await sql.unsafe(
        `UPDATE orders
         SET customer_name = $1, customer_email = $2, customer_phone = $3,
             shipping_address = $4, total_amount = $5, payment_method = 'Stripe',
             status = 'paid'
         WHERE id = $6 AND status = 'pending'
         RETURNING id`,
        [customerName, customerEmail, customerPhone, shippingAddress, paidAmount, orderId],
      );

      if (updateRes.length > 0) {
        console.log(`[wh-stripe] order #${orderId} pending → paid (webhook won the race)`);
        // Phase F — rpc هو المرسل الوحيد لإيميل التأكيد + CJ fulfillment
        void pbFulfillRegularOrder(orderId);
        await logEvent(sql, 'STRIPE_WEBHOOK_PAID', { amount: paidAmount, eventId: event.id }, orderId);
      } else {
        // سلوك idempotent: JIT/Reconcile/Webhook سابقو
        console.log(`[wh-stripe] order #${orderId} already processed — skipped duplicate`);
        await logEvent(sql, type, { note: 'already_locked' }, orderId);
      }
      return;
    }

    if (type === 'charge.refunded') {
      // استرجاع — محكوم على الحالات المدفوعة فقط
      const paymentIntent = String(session.payment_intent ?? '');
      if (paymentIntent && Number.isFinite(orderId)) {
        const upd = await sql.unsafe(
          `UPDATE orders SET status = 'refunded'
           WHERE id = $1 AND status IN ('paid', 'completed', 'fulfilled')
           RETURNING id`,
          [orderId],
        );
        await logEvent(
          sql,
          'STRIPE_WEBHOOK_REFUNDED',
          { paymentIntent, updated: upd.length > 0 },
          orderId,
          upd.length > 0 ? 'warning' : 'info',
        );
      }
      return;
    }

    // باقي الأحداث — سجل فقط (audit trail)
    await logEvent(sql, type || 'unknown', { eventId: event.id });
  } catch (e) {
    console.warn('[wh-stripe] process failed:',
      e instanceof Error ? e.message : e);
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}

async function logEvent(
  sql: { unsafe(q: string, p?: unknown[]): Promise<Record<string, unknown>[]> },
  eventType: string,
  details: Record<string, unknown>,
  orderId: number | null = null,
  severity: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    await sql.unsafe(
      `INSERT INTO system_events (event_type, order_id, details, severity)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [eventType.slice(0, 120), orderId, JSON.stringify(details), severity],
    );
  } catch { /* fail-open — التسجيل ما كيحبسش المعالجة */ }
}

export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => '');

  const { env } = await getPbRuntime();
  const secret = pbVar(env, 'STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    // fail-closed: بلا سرّ لا يمكن التحقق — 503 كيخلي Stripe يعاود (retry)
    console.error('[wh-stripe] STRIPE_WEBHOOK_SECRET missing');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const sig = await verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), secret);
  if (!sig.ok) {
    console.warn('[wh-stripe] signature rejected:', sig.reason, 'age:', sig.ageSeconds);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // 200 فوري — المعالجة خلفية (نفس عقد الباك: res.status(200) ثم المعالجة)
  const { waitUntil } = await getPbRuntime();
  waitUntil(processStripeEvent(event));
  return NextResponse.json({ received: true });
}
