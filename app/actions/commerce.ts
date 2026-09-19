'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * ⚡ Server Actions — Mission #17 — Typed RPC فوق Backend REST
 * لا منطق مكرر — الباكند هو المصدر الوحيد (financialGate/audit/DB)
 * ═══════════════════════════════════════════════════════════════
 */

import { backendFetch } from '@/lib/backend-server';

export interface CouponResult {
  ok: boolean;
  discount: number;
  message: string;
}

export interface ExchangeOption {
  id: string | number;
  title: string;
  price: number;
  image_url?: string;
}

// ═══ 1️⃣ Validate Coupon ═══
export async function validateCouponAction(
  code: string,
  cartTotal: number
): Promise<CouponResult> {
  try {
    const data = await backendFetch<CouponResult & { applied?: boolean }>('/api/validate-coupon', {
      method: 'POST',
      body: { code, cartTotal },
    });
        return {
      ok: Boolean(data.ok ?? data.applied ?? (data.discount > 0)),   // ✅ منطق مبسط بلا ?? unreachable
      discount: Number(data.discount) || 0,
      message: data.message || 'Coupon applied!',
    };
  } catch (e) {
    console.warn(`[Action:validateCoupon] failed: ${(e as Error).message}`);
    return { ok: false, discount: 0, message: 'Coupon validation failed' };
  }
}

// ═══ 2️⃣ Exchange — الخيارات + الاختيار ═══
export async function getExchangeOptionsAction(
  orderId: number
): Promise<{ options: ExchangeOption[] }> {
  try {
    const data = await backendFetch<{ options: ExchangeOption[] }>(
      `/api/exchange/${orderId}/options`
    );
    return { options: data.options || [] };
  } catch (e) {
    console.warn(`[Action:exchangeOptions] failed: ${(e as Error).message}`);
    return { options: [] };
  }
}

export async function pickExchangeAction(
  orderId: number,
  pickProductId: number | string
): Promise<{ success: boolean; message: string }> {
  try {
    return await backendFetch<{ success: boolean; message: string }>(
      `/api/exchange/${orderId}`,
      { method: 'POST', body: { pick: pickProductId } }
    );
  } catch (e) {
    console.warn(`[Action:pickExchange] failed: ${(e as Error).message}`);
    return { success: false, message: 'Exchange failed' };
  }
}

// ═══ 3️⃣ System Events — الأدمن فقط (كوكي الأدمن يُمرر تلقائيًا) ═══
export async function getSystemEventsAction(
  limit = 50,
  type?: string
): Promise<{ events: Record<string, unknown>[] }> {
  try {
    const qs = type ? `?limit=${Math.min(limit, 200)}&type=${encodeURIComponent(type)}` : `?limit=${Math.min(limit, 200)}`;
    const data = await backendFetch<{ events: Record<string, unknown>[] }>(
      `/api/admin/system-events${qs}`
    );
    // إن رد الباكند 401/403 فسيأتي جسم خطأ — نفحصه
    if (!Array.isArray(data.events)) {
      console.warn('[Action:systemEvents] unauthorized or error response');
      return { events: [] };
    }
    return { events: data.events };
  } catch (e) {
    console.warn(`[Action:systemEvents] failed: ${(e as Error).message}`);
    return { events: [] };
  }
}