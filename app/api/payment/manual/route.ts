// POST /api/payment/manual — BaridiMob / CCP إيصال التحويل (Worker-native)
// ═══════════════════════════════════════════════════════════════════════
// Phase G closure: Render BACKEND CLOSED نهائياً — هادا البديل الأصلي الكامل
// لـ POST /api/payment/manual (نفس عقد الفرونت حرفياً — PaymentModal.handleBaridiMobSubmit).
//
// التدفق:
//   1) Origin guard + rate limit (رفع ملفات = أصفى من checkout العادي)
//   2) FormData: receipt (jpeg/png/webp/pdf ≤ 8MB) + totalAmount + items JSON
//      + couponCode + utm JSON + customerName/Phone/Email/Address (JSON)
//   3) إعادة حساب السوم server-side (pbPrepareSecureItems + coupon) — ماشي الثقة فالعميل
//   4) الإيصال → R2 MEDIA_BUCKET receipts/{stamp}-{rand8}.{ext} (مفتاح غير قابل للتخمين —
//      الرابط نفسه هو التصريح) ثم phasei_manual_order_create بالرابط النهائي
//   5) orders: status='manual', payment_method='BaridiMob', manual_since=now() —
//      phasei_manual_orders_list كيشوفه، sweeper كيحيد >48h، approve كيدير 'paid'
//   6) الأصناف → phasef_crypto_item_add (عام — نفس order_items)
//   الرد: { success: true, orderNumber } — نفس العقد القديم
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbPrepareSecureItems, pbApplyCouponToTotal } from '@/lib/pb/pb-secure-checkout';
import { pbRequireUser, pbSecret, pbOriginOk } from '@/lib/pb/pb-user';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { getPbRuntime } from '@/lib/pb/pb-env';

export const dynamic = 'force-dynamic';

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function s(v: FormDataEntryValue | null, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  if (!pbOriginOk(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }
  if (!pbRateLimit(`manual:${pbClientIp(request)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many submission attempts. Please try again shortly.' }, { status: 429 });
  }
  try {
    const sql = await getRwSql();
    if (!sql) {
      console.warn('[pb-manual] no RW sql');
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Invalid form payload.' }, { status: 400 });
    }

    // ─── الإيصال ───
    const receipt = form.get('receipt');
    if (!receipt || typeof receipt === 'string' || typeof receipt.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'يرجى رفع صورة إيصال التحويل البنكي.' }, { status: 400 });
    }
    const mime = (receipt as File).type || '';
    const ext = MIME_TO_EXT[mime];
    if (!ext) {
      return NextResponse.json({ error: 'Receipt must be JPEG, PNG, WebP or PDF.' }, { status: 400 });
    }
    if ((receipt as File).size <= 0 || (receipt as File).size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: 'Receipt file is too large (max 8MB).' }, { status: 400 });
    }

    // ─── الحقول ───
    const customerName = s(form.get('customerName'), 150);
    const customerPhone = s(form.get('customerPhone'), 40);
    const customerEmail = s(form.get('customerEmail'), 200).toLowerCase();
    if (!customerPhone) {
      return NextResponse.json({ error: 'Phone number is required for BaridiMob orders.' }, { status: 400 });
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    let ship: { line1?: unknown; city?: unknown; state?: unknown; postal_code?: unknown } = {};
    try {
      ship = JSON.parse(s(form.get('customerAddress'), 2000) || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid address payload.' }, { status: 400 });
    }
    const line1 = String(ship.line1 || '').trim();
    if (!line1) {
      return NextResponse.json({ error: 'Shipping address is required.' }, { status: 400 });
    }
    const addressJson = JSON.stringify({
      line1: line1.slice(0, 300),
      city: String(ship.city || '').trim().slice(0, 100),
      state: String(ship.state || '').trim().slice(0, 100),
      postal_code: String(ship.postal_code || '').trim().slice(0, 20),
      country: 'DZ', // BaridiMob = Algeria فقط
    });

    const declaredRaw = Number(s(form.get('totalAmount'), 20));
    if (!Number.isFinite(declaredRaw) || declaredRaw <= 0) {
      return NextResponse.json({ error: 'Invalid total amount.' }, { status: 400 });
    }
    let items: unknown[] = [];
    try {
      const parsed = JSON.parse(s(form.get('items'), 100000) || '[]');
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
      items = parsed;
    } catch {
      return NextResponse.json({ error: 'Invalid items payload.' }, { status: 400 });
    }
    let couponCode: string | undefined;
    const cc = s(form.get('couponCode'), 60);
    if (cc) couponCode = cc;
    let utm: { source: string | null; medium: string | null; campaign: string | null; clickId: string | null } = {
      source: null, medium: null, campaign: null, clickId: null,
    };
    try {
      const u = JSON.parse(s(form.get('utm'), 2000) || '{}') as Record<string, unknown>;
      const str = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : null);
      utm = {
        source: str(u.source, 120),
        medium: str(u.medium, 120),
        campaign: str(u.campaign, 120),
        clickId: str(u.clickId, 250),
      };
    } catch {
      // utm اختياري — فشل الـ parse ما كتكسرش الطلب
    }

    // ─── الحقيقة من السيرفر (منع العبث بالأسعار) ───
    const { secureItems, serverTotal } = await pbPrepareSecureItems(sql, items);
    const { total: chargeTotalUsd } = await pbApplyCouponToTotal(sql, couponCode, serverTotal);
    if (!Number.isFinite(chargeTotalUsd) || chargeTotalUsd <= 0) {
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }
    const rateRaw = (await pbSecret('USD_TO_DZD_RATE')) ?? process.env.USD_TO_DZD_RATE;
    const rate = Number(rateRaw) || 255;
    const declaredDzd = Math.round(chargeTotalUsd * rate);

    // ─── الإيصال → R2 (قبل الطلب — المفتاح عشوائي بلا حاجة لـ order id؛
    //     إلا فشل إنشاء الطلب من بعد: orphan صغير غير قابل للتخمين — مقبول وموثق) ───
    const { env } = await getPbRuntime();
    const bucket = env.MEDIA_BUCKET as R2BucketLike | undefined;
    if (!bucket || typeof bucket.put !== 'function') {
      console.warn('[pb-manual] MEDIA_BUCKET missing');
      return NextResponse.json({ error: 'Receipt storage unavailable. Please try again.' }, { status: 503 });
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const key = `receipts/${stamp}-${rand}.${ext}`;
    const body = await (receipt as File).arrayBuffer();
    await bucket.put(key, new Uint8Array(body), { httpMetadata: { contentType: mime } });
    const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://laclarc.com';
    const receiptUrl = `${frontendUrl}/receipts/${key}`;

    // ─── الطلب في DB بالرابط النهائي ───
    const user = await pbRequireUser(request);
    const orderRows = await sql.unsafe(
      'SELECT phasei_manual_order_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS r',
      [
        customerName || 'Pending BaridiMob',
        customerPhone,
        customerEmail,
        addressJson,
        declaredDzd,
        user ? user.id : null,
        receiptUrl,
        utm.source, utm.medium, utm.campaign, utm.clickId,
      ],
    );
    const ord = orderRows[0]?.r as { ok?: boolean; id?: number; orderNumber?: string | null } | undefined;
    if (!ord || ord.ok !== true || !ord.id) {
      console.warn('[pb-manual] order create failed:', JSON.stringify(ord || {}));
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }

    // ─── الأصناف (phasef_crypto_item_add عام — نفس order_items) ───
    for (const item of secureItems) {
      await sql.unsafe('SELECT phasef_crypto_item_add($1,$2,$3,$4,$5) AS r', [
        ord.id,
        item.id,
        item.quantity,
        item.price,
        typeof item.vid === 'string' ? item.vid : '',
      ]);
    }

    return NextResponse.json({ success: true, orderNumber: ord.orderNumber });
  } catch (e) {
    console.warn('[pb-manual] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
