// POST /api/payment/crypto — Phase F (مرآة الأصلي v2.1): فاتورة NowPayments
// 503 gate بلا مفتاح · secureItems + coupon عبر pb-secure-checkout · الطلب 'pending'/'Crypto'
// العنوان من الـ form (v2) ولا 'Pending' (Address Guard كيكفل ما بعد الدفع)
// الرد: {url: invoice_url, orderNumber} — نفس العقد
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbPrepareSecureItems, pbApplyCouponToTotal } from '@/lib/pb/pb-secure-checkout';
import { pbRequireUser, pbSecret } from '@/lib/pb/pb-user';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

function extractUtm(body: Record<string, unknown>): {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  clickId: string | null;
} {
  const s = (v: unknown, max: number) =>
    typeof v === 'string' && v ? v.slice(0, max) : null;
  return {
    source: s(body.utm_source, 120),
    medium: s(body.utm_medium, 120),
    campaign: s(body.utm_campaign, 120),
    clickId: s(body.click_id, 250),
  };
}

export async function POST(request: Request) {
  if (!pbRateLimit(`checkout:${pbClientIp(request)}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many checkout attempts. Please try again shortly.' }, { status: 429 });
  }
  const npKey = await pbSecret('NOWPAYMENTS_API_KEY');
  if (!npKey) {
    return NextResponse.json({ error: 'Crypto payments are temporarily unavailable.' }, { status: 503 });
  }
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const {
      customerName, customerPhone, customerEmail,
      customerAddress, customerCity, customerState, customerZip,
    } = body as Record<string, string>;
    const utm = extractUtm(body);
    const user = await pbRequireUser(request);

    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    const hasCustomerDetails = Boolean(customerEmail && customerAddress);

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });

    const { secureItems, serverTotal } = await pbPrepareSecureItems(sql, body.items);
    const { total: chargeTotal } = await pbApplyCouponToTotal(
      sql,
      typeof body.couponCode === 'string' ? body.couponCode : undefined,
      serverTotal,
    );

    // العنوان المنظم (v2) ولا 'Pending' — Address Guard كيكفل البقية
    const fullAddress = hasCustomerDetails
      ? JSON.stringify({
          line1: String(customerAddress).trim().slice(0, 300),
          city: String(customerCity || '').trim().slice(0, 100),
          state: String(customerState || '').trim().slice(0, 100),
          postal_code: String(customerZip || '').trim().slice(0, 20),
          country:
            (customerState && /alger|dz/i.test(customerState) ? 'DZ' : '').trim() || 'ZZ',
        })
      : 'Pending';

    const orderRows = await sql.unsafe(
      'SELECT phasef_crypto_order_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r',
      [
        hasCustomerDetails ? String(customerName || '').trim() : 'Pending Crypto',
        String(customerPhone || '').trim(),
        hasCustomerDetails ? customerEmail.trim().toLowerCase() : '',
        fullAddress,
        chargeTotal,
        user ? user.id : null,
        utm.source,
        utm.medium,
        utm.campaign,
        utm.clickId,
      ],
    );
    const ord = orderRows[0]?.r as { ok?: boolean; id?: number; orderNumber?: string | null } | undefined;
    if (!ord || ord.ok !== true || !ord.id) {
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }
    const orderId = ord.id;

    for (const item of secureItems) {
      await sql.unsafe('SELECT phasef_crypto_item_add($1,$2,$3,$4,$5) AS r', [
        orderId,
        item.id,
        item.quantity,
        item.price,
        typeof item.vid === 'string' ? item.vid : '',
      ]);
    }

    const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://laclarc.com';
    const npRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'x-api-key': npKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: chargeTotal,
        price_currency: 'usd',
        order_id: orderId.toString(),
        order_description: `Laclarc Order ${ord.orderNumber || '#' + orderId}`,
        ipn_callback_url: 'https://laclarc.com/api/payment/crypto/callback',
        success_url: `${frontendUrl}/success?method=crypto&order_id=${orderId}`,
        cancel_url: `${frontendUrl}/cart`,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const np = (await npRes.json().catch(() => null)) as { id?: string; invoice_url?: string; message?: string } | null;
    if (!npRes.ok || !np?.invoice_url) {
      // 🩹 قنّع الخطأ (كان يسرّب تفاصيل NowPayments للعميل)
      console.warn('[pb-crypto] invoice failed:', npRes.status, np?.message || '');
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }
    if (np.id) {
      // 📝 receipt_url يحمل NP invoice id (semantic reuse — آمن، موثق)
      await sql.unsafe('SELECT phasef_crypto_set_receipt($1,$2) AS r', [orderId, np.id]);
    }
    return NextResponse.json({ url: np.invoice_url, orderNumber: ord.orderNumber });
  } catch (e) {
    console.warn('[pb-crypto] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
