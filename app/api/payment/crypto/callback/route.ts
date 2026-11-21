// POST /api/payment/crypto/callback — Phase F (مرآة الأصلي): NowPayments IPN
// HMAC-SHA512 على الجسم المرتّب + x-nowpayments-sig · finished/confirmed → pending→paid ذرياً
// Address Guard (Pending/N/A) → manual + CRYPTO_NO_ADDRESS critical
// نجاح → fulfill على rpc (fire-and-forget) + إيميل تأكيد
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbSecret } from '@/lib/pb/pb-user';
import { pbFulfillRegularOrder } from '@/lib/pb/pb-fulfill';
import { sendEmail } from '@/lib/emails';
import { orderConfirmation, orderSubject, type OrderEmailItem } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

function sortObject(obj: unknown): unknown {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const src = obj as Record<string, unknown>;
    return Object.keys(src)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObject(src[key]);
        return acc;
      }, {});
  }
  return obj;
}

function looksFakeAddress(raw: string): boolean {
  return !raw || raw === 'Pending' || /N\/A/i.test(raw);
}

export async function POST(request: Request) {
  try {
    const ipnSecret = await pbSecret('NOWPAYMENTS_IPN_SECRET');
    const receivedSig = request.headers.get('x-nowpayments-sig');
    if (!ipnSecret || !receivedSig) {
      return new NextResponse('Missing signature', { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const sorted = JSON.stringify(sortObject(body));
    const expectedSig = createHmac('sha512', ipnSecret).update(sorted).digest('hex');
    const a = Buffer.from(expectedSig);
    const b = Buffer.from(String(receivedSig));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const paymentStatus = typeof body.payment_status === 'string' ? body.payment_status : '';
    if (paymentStatus !== 'finished' && paymentStatus !== 'confirmed') {
      return new NextResponse('OK', { status: 200 });
    }
    const orderId = parseInt(String(body.order_id ?? ''), 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return new NextResponse('OK', { status: 200 });
    }

    const sql = await getRwSql();
    if (!sql) return new NextResponse('Error', { status: 500 });

    const paidRows = await sql.unsafe('SELECT phasef_crypto_ipn_paid($1,$2,$3) AS r', [
      orderId,
      typeof body.customer_email === 'string' ? body.customer_email : '',
      typeof body.payment_id === 'string' ? body.payment_id : '',
    ]);
    const ord = paidRows[0]?.r as
      | {
          id: number;
          customer_name: string | null;
          customer_email: string | null;
          total_amount: number;
          shipping_address: string | null;
          payment_method: string;
        }
      | null
      | undefined;
    // null = مسبقاً مدفوع (IPN ولا JIT سبقو) — 200 OK كيفما كان
    if (!ord) return new NextResponse('OK', { status: 200 });

    // 🩹 Address Guard — احتياطي فقط (الطلبات v2 عندهم عنوان قبل الدفع)
    const rawAddr = String(ord.shipping_address || '').trim();
    if (looksFakeAddress(rawAddr)) {
      await sql.unsafe('SELECT phasef_crypto_no_address($1,$2) AS r', [
        orderId,
        {
          amount: ord.total_amount,
          paymentRef: typeof body.payment_id === 'string' ? body.payment_id : null,
        },
      ]);
      return new NextResponse('OK', { status: 200 });
    }

    // حجز CJ + إيميل التأكيد — خلفياً (fire-and-forget)
    void (async () => {
      try {
        await pbFulfillRegularOrder(orderId);
        const itemsRes = await sql
          .unsafe('SELECT phasef_pixel_items($1) AS r', [orderId])
          .catch(() => [{ r: [] as unknown[] }]);
        const finalEmail =
          (typeof body.customer_email === 'string' && body.customer_email) || ord.customer_email;
        if (finalEmail && !finalEmail.includes('@laclarc.com')) {
          let orderNumber: string | null = null;
          try {
            const nRows = await sql.unsafe(
              'SELECT order_number FROM orders WHERE id = $1',
              [orderId],
            );
            orderNumber = (nRows[0]?.order_number as string | null) ?? null;
          } catch {
            /* order_number optional */
          }
          await sendEmail({
            to: finalEmail,
            subject: orderSubject(orderNumber, orderId),
            html: orderConfirmation({
              orderId,
              orderNumber: orderNumber ?? undefined,
              total: ord.total_amount,
              items: ((itemsRes[0]?.r as OrderEmailItem[]) ?? []) as OrderEmailItem[],
              customerName: ord.customer_name ?? undefined,
            }),
          });
        }
      } catch (e) {
        console.warn('[pb-crypto-ipn] bg failed:', e instanceof Error ? e.message : e);
      }
    })();

    return new NextResponse('OK', { status: 200 });
  } catch (e) {
    console.warn('[pb-crypto-ipn] failed:', e instanceof Error ? e.message : e);
    return new NextResponse('Error', { status: 500 });
  }
}
