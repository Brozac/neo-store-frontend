// POST /api/payment/crypto/verify — Phase F (مرآة الأصلي): JIT NowPayments Verifier
// سبقنا IPN → رد فوري كامل · استجواب NowPayments → finished/confirmed → pending→paid ذرياً
// → fulfill على rpc (fire-and-forget) — نفس عقد الرد {success,verified,orderId,amount,...}
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

    // استجواب مباشر لـ NowPayments
    if (!npKey) {
      return respond(ctx.status, false);
    }
    const npRes = await fetch(
      `https://api.nowpayments.io/v1/payment/?order_id=${orderId}&limit=1`,
      { headers: { 'x-api-key': npKey }, signal: AbortSignal.timeout(20000) },
    );
    const np = (await npRes.json().catch(() => null)) as {
      data?: Array<{ payment_status?: string }>;
    } | null;
    const paymentData = np?.data?.[0];
    // 🩹 SECURITY-FIX (B-M1): 'sending' ما تعدّش مدفوع — المؤكد فقط
    const isPaid =
      paymentData &&
      (paymentData.payment_status === 'finished' || paymentData.payment_status === 'confirmed');

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
