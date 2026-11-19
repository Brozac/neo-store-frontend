// lib/pb/pb-secure-checkout.ts — Phase B: منطق checkout المحصن — نقل حرفي من الباك
// ═══════════════════════════════════════════════════════════════════════
// المصادر (نفس الملفات فـ neo-store-backend):
//   utils/secureCheckout.js → prepareSecureItems / calculateSellPrice / tiers
//   utils/couponHelper.js   → applyCouponToTotal (fail-closed + سقف $0.50 + حجز ذري)
//   server.js               → getOrCreateStripeCoupon (DB-backed cache) + labels
// كل الأسعار من DB فقط (Tenet #1) — قيمة الكلاينت كتتجاهل تماماً.
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import type { RwSql } from './pb-db';
import { stripeCreateCoupon } from './pb-stripe';

const MAX_ITEM_QUANTITY = 50;

// معادلة التسعير الموحدة المطابقة لسياسة المتجر
export function calculateSellPrice(cost: unknown): number {
  const costNum = Number(cost) || 0;
  if (costNum <= 0) return 9.99;
  let sellingPrice =
    costNum <= 5 ? costNum * 3.5 : costNum <= 15 ? costNum * 2.8 : costNum <= 30 ? costNum * 2.2 : costNum * 1.8;
  sellingPrice = Math.max(9.99, Math.floor(sellingPrice) - 0.01);
  return parseFloat(sellingPrice.toFixed(2));
}

// خصم الكمية للباقات (Tiered Pricing)
export function applyTieredDiscount(price: number, quantity: number): number {
  if (quantity >= 3) return price * 0.75;
  if (quantity >= 2) return price * 0.85;
  return price;
}

export interface SecureItem {
  id: number;
  title: unknown;
  image_url: unknown;
  price: number;
  quantity: number;
  vid: string | null;
}

/**
 * نقل حرفي من utils/secureCheckout.js — الأسعار والـ vid من DB حصراً.
 */
export async function pbPrepareSecureItems(
  sql: RwSql,
  clientItems: unknown,
): Promise<{ secureItems: SecureItem[]; serverTotal: number }> {
  if (!clientItems || !Array.isArray(clientItems) || clientItems.length === 0) {
    throw new Error('Cart is empty');
  }

  // 1) تنظيف + دمج المكرر (id_vid)
  const consolidated = new Map<string, { id: number; vid: unknown; quantity: number }>();
  for (const item of clientItems as Record<string, unknown>[]) {
    const rawId = parseInt(String(item.id), 10);
    if (!rawId || isNaN(rawId) || rawId <= 0) continue;
    const rawVid = item.vid ? String(item.vid).trim() : 'DEFAULT';
    const rawQty = Math.min(MAX_ITEM_QUANTITY, Math.max(1, parseInt(String(item.quantity), 10) || 1));
    const key = `${rawId}_${rawVid}`;
    const existing = consolidated.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_ITEM_QUANTITY, existing.quantity + rawQty);
    } else {
      consolidated.set(key, { id: rawId, vid: item.vid ?? null, quantity: rawQty });
    }
  }
  if (consolidated.size === 0) throw new Error('No valid items found in the cart');

  const itemsToProcess = Array.from(consolidated.values());
  const productIds = [...new Set(itemsToProcess.map((i) => i.id))];

  // 2) استعلام ذري واحد (بلا N+1) — cast صريح ::int[] (إصلاح #4 من التقرير)
  const rows = await sql.unsafe(
    `SELECT id, title, price, image_url, variants FROM products
     WHERE id = ANY($1::int[]) AND COALESCE(shipping_blocked, false) = false AND stock_status = true`,
    [productIds],
  );
  if (rows.length === 0) throw new Error('Requested products are currently unavailable');

  const productMap = new Map(rows.map((p) => [Number(p.id), p]));
  const secureItems: SecureItem[] = [];
  let serverTotal = 0;

  // 3) لكل عنصر: مطابقة المتغير + التسعير من DB
  for (const item of itemsToProcess) {
    const dbProduct = productMap.get(item.id);
    if (!dbProduct) throw new Error(`Product #${item.id} is out of stock or does not exist`);

    let productVariants: Record<string, unknown>[] = [];
    if (dbProduct.variants) {
      try {
        productVariants =
          typeof dbProduct.variants === 'string'
            ? (JSON.parse(dbProduct.variants) as Record<string, unknown>[])
            : (dbProduct.variants as Record<string, unknown>[]);
      } catch {
        productVariants = [];
      }
    }

    let safeVid: string | null = null;
    let finalItemPrice = parseFloat(String(dbProduct.price));

    if (Array.isArray(productVariants) && productVariants.length > 0) {
      const requestedVid = item.vid ? String(item.vid) : null;
      let matched = requestedVid
        ? productVariants.find((v) => String(v.vid) === requestedVid)
        : undefined;
      if (!matched) matched = productVariants[0];
      safeVid = (matched.vid as string) || null;
      if (matched.variantSellPrice) {
        const variantCalculated = calculateSellPrice(matched.variantSellPrice);
        if (variantCalculated > finalItemPrice) finalItemPrice = variantCalculated;
      }
    }

    finalItemPrice = parseFloat(finalItemPrice.toFixed(2));
    const discountedUnitPrice = applyTieredDiscount(finalItemPrice, item.quantity);
    serverTotal += discountedUnitPrice * item.quantity;

    secureItems.push({
      id: Number(dbProduct.id),
      title: dbProduct.title,
      image_url: dbProduct.image_url,
      price: parseFloat(discountedUnitPrice.toFixed(2)),
      quantity: item.quantity,
      vid: safeVid,
    });
  }

  return { secureItems, serverTotal: parseFloat(serverTotal.toFixed(2)) };
}

export interface CouponRow extends Record<string, unknown> {
  discount_type?: string;
  discount_value?: unknown;
  max_uses?: number | null;
  used_count?: number | null;
}

export interface CouponResult {
  total: number;
  applied: boolean;
  discount: number;
  clamped: boolean;
  coupon: CouponRow | null;
}

/**
 * نقل حرفي من utils/couponHelper.js:
 * fail-closed · expires_at · max_uses/used_count · سقف $0.50 (Stripe min) · حجز ذري.
 */
export async function pbApplyCouponToTotal(
  sql: RwSql,
  code: unknown,
  secureTotal: number,
): Promise<CouponResult> {
  const fail: CouponResult = { total: secureTotal, applied: false, discount: 0, clamped: false, coupon: null };
  if (!code || typeof secureTotal !== 'number' || secureTotal <= 0) return fail;
  const cleanCode = String(code).toUpperCase().trim().slice(0, 50);
  try {
    const rows = await sql.unsafe(
      `SELECT * FROM coupons
       WHERE code = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [cleanCode],
    );
    if (rows.length === 0) return fail;

    const coupon = rows[0] as CouponRow;
    let discount =
      coupon.discount_type === 'percentage'
        ? (secureTotal * Number(coupon.discount_value)) / 100
        : Number(coupon.discount_value);
    if (!Number.isFinite(discount) || discount <= 0) return fail;

    // 🛡️ الحد الأدنى للدفع: Stripe كيرفض أقل من $0.50
    const clamped = discount > secureTotal - 0.50;
    discount = Math.min(discount, Math.max(0, secureTotal - 0.50));

    // حجز ذري — واحد برك كيربح على آخر استعمال متاح
    if (coupon.max_uses !== undefined && coupon.max_uses !== null) {
      const reserved = await sql.unsafe(
        `UPDATE coupons SET used_count = used_count + 1
         WHERE code = $1 AND (max_uses IS NULL OR used_count < max_uses)
         RETURNING id`,
        [cleanCode],
      );
      if (reserved.length === 0) return fail;
    }

    return {
      total: parseFloat((secureTotal - discount).toFixed(2)),
      applied: true,
      discount: parseFloat(discount.toFixed(2)),
      clamped,
      coupon,
    };
  } catch {
    return fail; // ✅ Fail-closed
  }
}

// ─── Stripe coupon cache — DB-backed (store_settings stripe_coupon_*) ───
// RLS لدور rw كيسمح كتابة على المفاتيح stripe_coupon_* فقط — الإعدادات محمية.
const couponCache = new Map<string, string>();

export async function pbGetOrCreateStripeCoupon(
  sql: RwSql,
  stripeSecret: string,
  waitUntil: (p: Promise<unknown>) => void,
  couponData: Record<string, unknown>,
): Promise<string | null> {
  const key = JSON.stringify(couponData);
  const cached = couponCache.get(key);
  if (cached) return cached;

  // DB cache أول الشي (كيعيش عبر deploys)
  try {
    const persisted = await sql.unsafe(
      'SELECT value FROM store_settings WHERE key = $1',
      ['stripe_coupon_' + key],
    );
    const v = persisted[0]?.value;
    if (typeof v === 'string' && v) {
      couponCache.set(key, v);
      return v;
    }
  } catch (e) {
    console.warn('[pb] coupon cache read failed:', e instanceof Error ? e.message : e);
  }

  const created = await stripeCreateCoupon(stripeSecret, couponData);
  if (!created.ok || !created.id) return null;
  couponCache.set(key, created.id);
  if (couponCache.size > 200) {
    couponCache.delete(couponCache.keys().next().value as string);
  }
  // persist — ما عادش يتيم
  waitUntil(
    sql
      .unsafe(
        'INSERT INTO store_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['stripe_coupon_' + key, created.id],
      )
      .catch(() => {}),
  );
  return created.id;
}

export function pbNormalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function pbGetStatusLabel(status: unknown): string {
  const MAP: Record<string, string> = {
    pending: '⏳ Awaiting Payment',
    paid: '✅ Payment Confirmed',
    awaiting_exchange: '📦 Alternative Offered — Check Email',
    processing: '⏳ Processing',
    manual: '⏳ Under Review',
    fulfilled: '🚚 Shipped',
    completed: '✅ Delivered',
    refunded: '💰 Refunded',
    cancelled: '❌ Cancelled',
    expired: '⏱ Expired',
    archived: '📦 Archived',
  };
  return MAP[String(status ?? '').toLowerCase()] || String(status ?? '');
}

// 222 دولة CJ-verified — fallback إلا shipping_matrix خاوية (نفس الباك)
export const PB_ALL_WORLD_COUNTRIES = ['AC','AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CV','CW','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MK','ML','MM','MN','MO','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SZ','TA','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','US','UY','UZ','VA','VC','VE','VG','VN','VU','WF','WS','XK','YE','YT','ZA','ZM','ZW','ZZ'];

export const PB_ANTI_CLONE_ORIGINS = new Set([
  'https://laclarc.com',
  'https://www.laclarc.com',
]);

/** auth من Bearer ولا كوكي الجلسة — نفس authenticateToken (بدون CSRF إلا كوكي+mutating) */
export function pbExtractToken(request: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader && authHeader.split(' ')[1];
  if (headerToken) return { token: headerToken, viaCookie: false };
  const cookieHeader = request.headers.get('cookie') || '';
  const m = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
  return { token: m ? decodeURIComponent(m[1]) : null, viaCookie: true };
}

/** CSRF defense: كوكي + method مغيرة → Origin إجباري من القائمة البيضاء */
export function pbCsrfOk(request: Request, viaCookie: boolean): boolean {
  if (!viaCookie) return true;
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return true;
  const origin = request.headers.get('origin') || '';
  if (!origin) return true; // SSR / server-to-server
  return PB_ANTI_CLONE_ORIGINS.has(origin);
}
