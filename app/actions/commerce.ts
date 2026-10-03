'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * ⚡ Server Actions — Mission #17 — Typed RPC over Backend REST
 * No duplicated logic — the backend is the single source of truth
 * (financialGate / audit / DB)
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
      ok: Boolean(data.ok ?? data.applied ?? (data.discount > 0)),
      discount: Number(data.discount) || 0,
      message: data.message || 'Coupon applied!',
    };
  } catch (e) {
    console.warn(`[Action:validateCoupon] failed: ${(e as Error).message}`);
    return { ok: false, discount: 0, message: 'Coupon validation failed' };
  }
}

// ═══ 2️⃣ Exchange — options + pick (token-gated — IDOR fix) ═══
export type ExchangeStatus =
  | 'awaiting_exchange'
  | 'exchanged'
  | 'refunded'
  | 'processing'
  | 'invalid'
  | 'net';

// 🆕 machine-readable failure reason from the backend — the UI maps it to the right screen
// (before: every failure landed on "Connection problem", even an expired link)
export type ExchangeFailCode = 'invalid_link' | 'already_picked' | 'stale_option' | 'internal';

const EXCHANGE_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCHANGE_FAIL_CODES: readonly string[] = ['invalid_link', 'already_picked', 'stale_option', 'internal'];

export interface ExchangeOptionsResult {
  status: ExchangeStatus;
  options: ExchangeOption[];
  detail?: string; // 🩹 E2 — 'manual' distinguishes a halted booking from in-flight polling
}

export async function getExchangeOptionsAction(
  orderId: number,
  token: string
): Promise<ExchangeOptionsResult> {
  if (!Number.isInteger(orderId) || orderId <= 0 || !EXCHANGE_TOKEN_RE.test(token)) {
    return { status: 'invalid', options: [] };
  }
  try {
    const data = await backendFetch<{ status?: ExchangeStatus; options?: ExchangeOption[]; detail?: string }>(
      `/api/exchange/${orderId}/options?t=${encodeURIComponent(token)}`
    );
    // backendFetch throws on !res.ok — a body without `status` = unexpected shape → 'net'
    // (the backend always sends an explicit status for real answers)
    if (!data || typeof data.status !== 'string') return { status: 'net', options: [] };
    return { status: data.status, options: data.options || [], detail: data.detail };
  } catch {
    return { status: 'net', options: [] };
  }
}

export async function pickExchangeAction(
  orderId: number,
  token: string,
  pickProductId: number | string
): Promise<{ success: boolean; message: string; code?: ExchangeFailCode }> {
  if (!Number.isInteger(orderId) || orderId <= 0 || !EXCHANGE_TOKEN_RE.test(token)) {
    return { success: false, message: 'Invalid link', code: 'invalid_link' };
  }
  try {
    const data = await backendFetch<{ success?: boolean; message?: string; code?: string }>(
      `/api/exchange/${orderId}`,
      { method: 'POST', body: { pick: pickProductId, token } }
    );
    // 🆕 defensive: an error body without `success: true` must never read as success
    const code = data.code && EXCHANGE_FAIL_CODES.includes(data.code)
      ? (data.code as ExchangeFailCode)
      : undefined;
    return { success: Boolean(data.success), message: data.message || '', code };
  } catch {
    return { success: false, message: 'Network error — please try again' };
  }
}

export async function getSystemEventsAction(
  limit = 50,
  type?: string
): Promise<{ events: Record<string, unknown>[] }> {
  try {
    const qs = type
      ? `?limit=${Math.min(limit, 200)}&type=${encodeURIComponent(type)}`
      : `?limit=${Math.min(limit, 200)}`;
    const data = await backendFetch<{ events: Record<string, unknown>[] }>(
      `/api/admin/system-events${qs}`
    );
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