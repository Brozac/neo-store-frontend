// lib/pb/pb-limiter.ts — Phase B: limiter مبسط per-isolate (نفس حدود الباك)
// الحد الحقيقي كيتزاد بـ WAF rate-limit على /api/* لاحقاً (موثق فالتقرير).
// الحدود مطابقة للباك: coupon 20/15min · checkout 25/15min · wheel 10/15min.
import 'server-only';

const buckets = new Map<string, { count: number; reset: number }>();

export function pbRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10000) {
      // تنظيف دوري — لا نمو بلا حدود فالذاكرة
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function pbClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export const PB_LIMITS = {
  coupon: { max: 20, windowMs: 15 * 60 * 1000 },
  checkout: { max: 25, windowMs: 15 * 60 * 1000 },
  wheel: { max: 10, windowMs: 15 * 60 * 1000 },
} as const;

export const PB_LIMIT_MESSAGES = {
  coupon: 'Too many attempts, please try again later.',
  checkout: 'Too many checkout attempts, please try again in a few minutes.',
  wheel: 'Too many wheel claims, please try again later.',
} as const;
