// POST /api/create-checkout-session — Phase B (proxy → fallback bank-grade)
// ═══════════════════════════════════════════════════════════════════════
// نقل حرفي من server.js (المسار الملك الوحيد) مع Tenet #1:
//   الأسعار من DB حصراً — قيمة الكلاينت ($0.01 تلاعب) كتتجاهل تماماً.
// الـ fallback كيخدم بدور laclarc_rw (صلاحيات مضيقة بالعمود — بلا DELETE).
// CJ live bridge + الإيميلات كيبقاو على Render (Reconcile كيلقط بعد الرجوع).
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbRuntime, pbVar } from '@/lib/pb/pb-env';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';
import { stripeCreateCheckoutSession } from '@/lib/pb/pb-stripe';
import {
  pbPrepareSecureItems,
  pbApplyCouponToTotal,
  pbGetOrCreateStripeCoupon,
  PB_ALL_WORLD_COUNTRIES,
  pbExtractToken,
  pbCsrfOk,
} from '@/lib/pb/pb-secure-checkout';
import { pbRateLimit, pbClientIp, PB_LIMITS, PB_LIMIT_MESSAGES } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

const GENERIC_ERROR = 'Failed to create checkout session. Please try again.';

export async function POST(request: Request) {
  // البودي مرة وحدة — stream كيتستهلك (الـ proxy والـ fallback كيتقاسموه)
  const rawBody = await request.text().catch(() => '');

  // 1) proxy — Render حي = نفس السلوك حرفياً (حتى live bridge ديال CJ)
  const proxied = await pbProxy(request, '/api/create-checkout-session', rawBody, 15000);
  if (proxied) return proxied;

  // 2) fallback أصلي — Stripe + Supabase نيشان
  let orderId: number | null = null;
  let sql: Awaited<ReturnType<typeof getRwSql>> = null;
  try {
    if (!pbRateLimit(`checkout:${pbClientIp(request)}`, PB_LIMITS.checkout.max, PB_LIMITS.checkout.windowMs)) {
      return NextResponse.json({ error: PB_LIMIT_MESSAGES.checkout }, { status: 429 });
    }

    const { env, waitUntil } = await getPbRuntime();
    const stripeSecret = pbVar(env, 'STRIPE_SECRET_KEY');
    if (!stripeSecret) return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });

    sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });

    let body: Record<string, unknown> = {};
    try { body = JSON.parse(rawBody || '{}') as Record<string, unknown>; } catch { body = {}; }
    const clientItems = body.items;
    const origin = body.origin;
    const couponCode = body.couponCode;
    const utm = body.utm as Record<string, unknown> | undefined;
    const wheelToken = typeof body.wheelToken === 'string' ? body.wheelToken : undefined;

    let baseUrl =
      typeof origin === 'string' && origin.startsWith('http')
        ? origin
        : pbVar(env, 'FRONTEND_URL') || 'https://laclarc.com';
    baseUrl = baseUrl.replace(/\/+$/, '');

    // 🌍 live_pid → محاولة مطابقة محلية بـ cj_product_id (بلا CJ calls هنا —
    //   الاستيراد الفعلي كيبقى لما Render يرجع)
    let items: unknown = clientItems;
    if (Array.isArray(clientItems)) {
      items = await Promise.all(
        (clientItems as Record<string, unknown>[]).map(async (item) => {
          if (item?.live_pid && sql) {
            try {
              const found = await sql.unsafe(
                'SELECT id FROM products WHERE cj_product_id = $1 LIMIT 1',
                [String(item.live_pid).trim().slice(0, 100)],
              );
              if (found.length > 0) return { ...item, id: Number(found[0].id), live_pid: undefined };
            } catch { /* نكمل بالـ id الأصلي */ }
          }
          return item;
        }),
      );
    }

    // ─── الأسعار من DB فقط (Tenet #1) ───
    const { secureItems, serverTotal } = await pbPrepareSecureItems(sql, items);

    // ─── المستخدم الاختياري (attribution) — JWT بنفس سر الباك ───
    let userId: number | null = null;
    const { token, viaCookie } = pbExtractToken(request);
    if (token && pbCsrfOk(request, viaCookie)) {
      const jwtSecret = await getPbJwtSecret();
      if (jwtSecret) {
        const user = await pbVerifyJwt(token, jwtSecret);
        if (user && typeof user.id === 'number') userId = user.id;
      }
    }

    // ─── utm — نفس حدود slicing ديال الباك ───
    const utmSource = utm?.utm_source ? String(utm.utm_source).slice(0, 100) : 'organic';
    const utmMedium = utm?.utm_medium ? String(utm.utm_medium).slice(0, 100) : 'direct';
    const utmCampaign = utm?.utm_campaign ? String(utm.utm_campaign).slice(0, 150) : null;
    const clickId = utm?.click_id ? String(utm.click_id).slice(0, 255) : null;

    // ─── تسجيل الطلب (مرة واحدة) ───
    const orderRows = await sql.unsafe(
      `INSERT INTO orders (customer_name, customer_email, shipping_address, total_amount, status,
         user_id, payment_method, utm_source, utm_medium, utm_campaign, click_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'Stripe', $7, $8, $9, $10) RETURNING id`,
      ['Pending Customer', 'pending@laclarc.com', 'Pending', serverTotal, 'pending',
       userId, utmSource, utmMedium, utmCampaign, clickId],
    );
    orderId = Number(orderRows[0].id);

    for (const item of secureItems) {
      await sql.unsafe(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, vid) VALUES ($1, $2, $3, $4, $5)',
        [orderId, item.id, item.quantity, item.price, item.vid],
      );
    }

    // ─── الكوبون عبر الـ Helper الموحد (fail-closed + حجز ذري) ───
    const { applied: couponApplied, discount: couponDiscount, clamped, coupon: couponRow } =
      await pbApplyCouponToTotal(sql, couponCode, serverTotal);

    const stripeDiscounts: Record<string, unknown>[] = [];
    if (couponApplied && couponRow) {
      const useNativePercent =
        couponRow.discount_type === 'percentage' && !clamped && Number(couponRow.discount_value) < 100;
      const couponData = useNativePercent
        ? { percent_off: parseFloat(String(couponRow.discount_value)), duration: 'once' }
        : { amount_off: Math.round(couponDiscount * 100), currency: 'usd', duration: 'once' };
      const couponId = await pbGetOrCreateStripeCoupon(sql, stripeSecret, waitUntil, couponData);
      if (couponId) stripeDiscounts.push({ coupon: couponId });
    }

    // ─── 🎡 العجلة — من token موقّع فقط (max 15%) ───
    let wheelPct = 0;
    if (wheelToken) {
      const jwtSecret = await getPbJwtSecret();
      if (jwtSecret) {
        try {
          const wheelClaim = await pbVerifyJwt(wheelToken, jwtSecret);
          if (wheelClaim && wheelClaim.type === 'wheel') {
            wheelPct = Math.min(15, Math.max(0, Number(wheelClaim.pct) || 0));
          }
        } catch { /* token قديم/مزور — بلا خصم */ }
      }
    }
    if (wheelPct > 0) {
      const wheelOff = Math.round(((serverTotal * wheelPct) / 100) * 100);
      if (wheelOff > 0) {
        const couponId = await pbGetOrCreateStripeCoupon(
          sql, stripeSecret, waitUntil,
          { amount_off: wheelOff, currency: 'usd', duration: 'once' },
        );
        if (couponId) stripeDiscounts.push({ coupon: couponId });
      }
    }

    // ─── الدول المسموحة — من shipping_matrix (fallback: الكل) ───
    let allowedCountries: string[] = PB_ALL_WORLD_COUNTRIES;
    try {
      const supported = await sql.unsafe(
        'SELECT country_code FROM shipping_matrix WHERE is_supported = true',
      );
      if (supported.length > 0) allowedCountries = supported.map((r) => String(r.country_code));
    } catch {
      console.warn('[pb] shipping_matrix unavailable — fallback ALL_WORLD_COUNTRIES');
    }

    // ─── Stripe session — نفس الـ params بالضبط ───
    const session = await stripeCreateCheckoutSession(stripeSecret, {
      payment_method_types: ['card'],
      line_items: secureItems.map((item) => {
        const hasValidImage =
          item.image_url && typeof item.image_url === 'string' && (item.image_url as string).startsWith('http');
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: String(item.title || 'Product'),
              images: hasValidImage ? [item.image_url] : [],
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        };
      }),
      mode: 'payment',
      shipping_address_collection: { allowed_countries: allowedCountries },
      phone_number_collection: { enabled: true },
      ...(stripeDiscounts.length > 0 ? { discounts: stripeDiscounts } : {}),
      shipping_options: [
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 0, currency: 'usd' }, display_name: 'Standard Shipping', delivery_estimate: { minimum: { unit: 'business_day', value: 15 }, maximum: { unit: 'business_day', value: 35 } } } },
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 1500, currency: 'usd' }, display_name: 'Worldwide Express Shipping', delivery_estimate: { minimum: { unit: 'business_day', value: 7 }, maximum: { unit: 'business_day', value: 15 } } } },
      ],
      metadata: {
        orderId: orderId.toString(),
        couponCode: couponApplied ? String(couponCode).toUpperCase() : '',
        utmSource,
        utmCampaign: utmCampaign || '',
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    if (!session.ok || typeof session.json.url !== 'string') {
      throw new Error(`stripe ${session.status}`);
    }

    await sql.unsafe('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.json.id, orderId]);
    return NextResponse.json({ url: session.json.url });
  } catch (e) {
    // 🧹 فشل Stripe → pending كيتلغى ذرياً (لا يتيم فالـ Reconcile)
    if (orderId && sql) {
      await sql
        .unsafe("UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'", [orderId])
        .catch(() => {});
    }
    console.warn('[pb] create-checkout-session failed:', e instanceof Error ? e.message : e);
    // الرسالة masked — لا تسريب تفاصيل Stripe (نفس الباك FIX-ERR)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
