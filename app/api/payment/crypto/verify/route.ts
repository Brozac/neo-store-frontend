// POST /api/payment/crypto/verify — Phase F (مرآة الأصلي): JIT NowPayments Verifier
// سبقنا IPN → رد فوري كامل · استجواب NowPayments → finished/confirmed → pending→paid ذرياً
// → fulfill على rpc (fire-and-forget) — نفس عقد الرد {success,verified,orderId,amount,...}
// 🩹 NP-C1: الاستجواب بـ invoiceId (فلتر رسمي مدعوم فـ GET /v1/payment/) — order_id كفلتر ما كيدعمهش
//    الـ API (validators.js ديال SDK الرسمي: limit/page/sortBy/orderBy/dateFrom/dateTo/invoiceId فقط)
// 🩹 NP-C2: قبل تعليم paid كنتحققو finished/confirmed + order_id مطابق + price_amount مطابق للـ total
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbSecret } from '@/lib/pb/pb-user';
import { pbFulfillRegularOrder } from '@/lib/pb/pb-fulfill';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!pbRateLimit(`crypto-verify:${pbClientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }
  const { order_id } = (await request.json().catch(() => ({}))) as { order_id?: unknown };
  if (!order_id) {
    return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
  }
  const orderId = parseInt(String(order_id), 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  try {
    const npKey = await pbSecret('NOWPAYMENTS_API_KEY');
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ success: false, error: 'Failed to verify crypto payment' }, { status: 500 });

    const ctxRows = await sql.unsafe('SELECT phasef_crypto_context($1) AS r', [orderId]);
    const ctx = ctxRows[0]?.r as
      | { id: number; total_amount: number; status: string; payment_method: string }
      | null
      | undefined;
    if (!ctx) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    const verifiedAmount = parseFloat(String(ctx.total_amount));

    const respond = (status: string, verified: boolean) =>
      NextResponse.json({
        success: true,
        verified,
        orderId: ctx.id,
        amount: verifiedAmount,
        currency: 'USD',
        status,
        items: null, // الجبهة ما كتعتمدش على items هنا (نفس فرع الأصلي النهائي)
      });

    // الفرع A: سبقنا الـ IPN/JIT — الطلب مدفوع خلاص
    if (ctx.status === 'paid' || ctx.status === 'completed' || ctx.status === 'fulfilled') {
      return respond(ctx.status, true);
    }

    // 🩹 NP-C1: receipt_url كيحمل NP invoice id (كيتسجل عند إنشاء الفاتورة — phasef_crypto_set_receipt)
    let invoiceId = '';
    try {
      const rcRows = await sql.unsafe('SELECT receipt_url FROM orders WHERE id = $1', [orderId]);
      const raw = (rcRows[0]?.receipt_url as unknown) ?? null;
      invoiceId = raw == null ? '' : String(raw).trim();
    } catch {
      invoiceId = '';
    }

    // استجواب مباشر لـ NowPayments — بـ invoiceId فقط (فلتر مدعوم رسمياً)
    if (!npKey || !invoiceId) {
      return respond(ctx.status, false); // بلا invoice id ما كنقدروش نلقاو دفعتنا بأمان — IPN هو المرجع
    }
    const npRes = await fetch(
      `https://api.nowpayments.io/v1/payment/?invoiceId=${encodeURIComponent(invoiceId)}&limit=5`,
      { headers: { 'x-api-key': npKey }, signal: AbortSignal.timeout(20000) },
    );
    const np = (await npRes.json().catch(() => null)) as {
      data?: Array<{ payment_status?: string; order_id?: unknown; price_amount?: unknown }>;
    } | null;
    const payments = Array.isArray(np?.data) ? (np?.data ?? []) : [];
    // 🩹 NP-C2 + SECURITY-FIX (B-M1): دفعتنا = من فاتورتنا (invoiceId) + finished/confirmed فقط ('sending'
    //    ما تعدّش مدفوع) + order_id مطابق (ولا null) + المبلغ مطابق — بلا الشروط كاملين ما كنعلّموش paid
    const paymentData = payments.find((p) => {
      if (p.payment_status !== 'finished' && p.payment_status !== 'confirmed') return false;
      if (p.order_id != null && String(p.order_id) !== String(orderId)) return false;
      const pa = Number(p.price_amount);
      return Number.isFinite(pa) && Math.abs(pa - verifiedAmount) <= 0.01;
    });
    const isPaid = Boolean(paymentData);

    if (isPaid) {
      // قفل ذري: pending → paid — واحد برك يربح (JIT ولا IPN)
      const upd = await sql.unsafe('SELECT phasef_crypto_mark_paid($1) AS r', [orderId]);
      const flipped = (upd[0]?.r as { ok?: boolean } | undefined)?.ok === true;
      if (flipped) {
        await pbFulfillRegularOrder(orderId); // حجز CJ خلفياً
      }
      return respond('paid', true);
    }
    return respond(ctx.status, false);
  } catch (e) {
    console.warn('[pb-crypto-verify] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: 'Failed to verify crypto payment' },
      { status: 500 },
    );
  }
}
