// POST /api/payment/verify-session — Phase B (proxy → fallback: JIT Stripe verifier)
// ═══════════════════════════════════════════════════════════════════════
// نقل حرفي من server.js — الجولة الذهبية:
//   Stripe retrieve → metadata.orderId → payment_status=paid → قفل ذري
//   pending→paid (واحد برك من JIT/Webhook/Reconcile كيربح) → رد فوري.
// CJ + الإيميلات: كيتأجلو لرجوع Render (Reconcile كيلقط paid بلا
// cj_order_number) — الزائر كيشوف التأكيد فالموقع مباشرة.
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbRuntime, pbVar } from '@/lib/pb/pb-env';
import { stripeRetrieveCheckoutSession } from '@/lib/pb/pb-stripe';
import { pbNormalizeEmail } from '@/lib/pb/pb-secure-checkout';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // البودي مرة وحدة — stream كيتستهلك
  const rawBody = await request.text().catch(() => '');

  // 1) proxy — Render حي = نفس السلوك حرفياً (+ CJ فوري من عندو)
  const proxied = await pbProxy(request, '/api/payment/verify-session', rawBody, 15000);
  if (proxied) return proxied;

  // 2) fallback أصلي — Stripe REST + قفل ذري فالـ DB
  try {
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(rawBody || '{}') as Record<string, unknown>; } catch { body = {}; }
    const sessionId = body.session_id;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 500) {
      return NextResponse.json({ success: false, error: 'Session ID is required' }, { status: 400 });
    }

    const { env } = await getPbRuntime();
    const stripeSecret = pbVar(env, 'STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return NextResponse.json({ success: false, error: 'Failed to verify payment with Stripe' }, { status: 500 });
    }

    // 1) استجواب مباشر وفوري لخوادم Stripe
    const r = await stripeRetrieveCheckoutSession(stripeSecret, sessionId);
    if (!r.ok) {
      // session_id غير صالح/منتهي → 404 نظيف (نفس الباك)
      return NextResponse.json({ success: false, error: 'Invalid checkout session' }, { status: 404 });
    }
    const session = r.json;

    const metadata = (session.metadata ?? {}) as Record<string, unknown>;
    if (!session || typeof metadata.orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid checkout session' }, { status: 404 });
    }
    const orderId = parseInt(metadata.orderId, 10);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid checkout session' }, { status: 404 });
    }

    // 2) التحقق الجازم: هل الدفع تم 100%؟
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          status: 'unpaid',
          message: 'Payment has not been completed or was declined by the bank.',
        },
        { status: 400 },
      );
    }

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
    const addr =
      customerDetails.address ||
      shippingDetails.address ||
      null;
    const shippingAddress = addr
      ? JSON.stringify(addr)
      : JSON.stringify({ line1: 'Online Store Purchase', country: 'US' });
    const paidAmount = Number(session.amount_total) / 100;

    const sql = await getRwSql();
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Failed to verify payment with Stripe' }, { status: 500 });
    }

    // 3) قفل ذري: pending → paid — واحد فقط كيربح (JIT ولا Webhook ولا Reconcile)
    const updateRes = await sql.unsafe(
      `UPDATE orders
       SET customer_name = $1, customer_email = $2, customer_phone = $3,
           shipping_address = $4, total_amount = $5, payment_method = 'Stripe',
           status = 'paid'
       WHERE id = $6 AND status = 'pending'
       RETURNING id`,
      [customerName, customerEmail, customerPhone, shippingAddress, paidAmount, orderId],
    );

    const orderRes = await sql.unsafe('SELECT * FROM orders WHERE id = $1', [orderId]);
    const fullOrder = orderRes[0];
    if (!fullOrder) {
      // metadata يشير لطلب ماشي موجود (session قديم/test) — رد نظيف
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const itemsRes = await sql.unsafe(
      `SELECT oi.*, p.title, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId],
    );

    if (updateRes.length > 0) {
      console.log(`[pb-jit] order #${orderId} verified with Stripe → paid (CJ/email → Render Reconcile)`);
    } else {
      console.log(`[pb-jit] order #${orderId} already locked/processed`);
    }

    // 4) الرد الفوري — نفس الشكل بالضبط
    return NextResponse.json({
      success: true,
      verified: true,
      orderId: fullOrder.id,
      amount: paidAmount,
      currency: String(session.currency || 'USD').toUpperCase() || 'USD',
      customerEmail: fullOrder.customer_email,
      status: fullOrder.status,
      items: itemsRes.map((i) => ({ productId: Number(i.product_id), quantity: Number(i.quantity) })),
    });
  } catch (e) {
    console.warn('[pb] verify-session failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: 'Failed to verify payment with Stripe' }, { status: 500 });
  }
}
