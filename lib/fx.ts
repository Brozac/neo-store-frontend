// lib/fx.ts — phase-abc: سعر الصرف USD/DZD حي في STORE_KV (البند 5)
// ═══════════════════════════════════════════════════════════════════════
// لا يوجد أي مصدر سعر صرف في الكود اليوم — البند أ كيطلب "أسعار الصرف في
// STORE_KV". المصدر: API مجانية بلا مفتاح + fallback ثانوية + آخر قيمة KV:
//   1) https://open.er-api.com/v6/latest/USD  → data.rates.DZD (مجانية بلا key)
//   2) https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json
//      → usd.dzd (CDN مجانية)
//   3) آخر قيمة مخزّنة فالـ KV حتى إلا قديمة (الـ feed كيبقى كيتولد)
// كتخدم fail-open: أي فشل = null والمنادي (الـ feed USD) كيتخطّى بهدوء.
// ═══════════════════════════════════════════════════════════════════════
import { kvGetJson, kvPutJson, type KvLike } from './kv-store';

const FX_KV_KEY = 'fx:usd-dzd';
/** القيمة الحية كتعتبر طازة أقل من 26 ساعة (تحديث يومي عند الكرون 3:00) */
const FX_FRESH_MS = 26 * 60 * 60 * 1000;
/** الكتابة في KV — 30 يوم (القيمة القديمة كتبقى شبكة أمان للقراءة) */
const FX_KV_TTL_S = 30 * 24 * 60 * 60;
/** حدود معقولة — الدفاع ضد قيم API فاسدة */
const FX_MIN = 50;
const FX_MAX = 1000;

export interface FxRate {
  /** كم دينار جزائري مقابل دولار واحد */
  dzdPerUsd: number;
  /** epoch ms الجلب */
  at: number;
}

function validRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= FX_MIN && v <= FX_MAX;
}

async function fetchErApi(): Promise<FxRate | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = j?.rates?.DZD;
    if (j.result !== 'success' || !validRate(rate)) return null;
    return { dzdPerUsd: rate, at: Date.now() };
  } catch {
    return null;
  }
}

async function fetchJsdelivrApi(): Promise<FxRate | null> {
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { date?: string; usd?: Record<string, number> };
    const rate = j?.usd?.dzd;
    if (!validRate(rate)) return null;
    return { dzdPerUsd: rate, at: Date.now() };
  } catch {
    return null;
  }
}

/**
 * سعر الصرف الحي — الأولىوية: KV طازة ← API 1 ← API 2 ← KV قديمة.
 * `kvOverride` للكرون (env مباشر خارج getCloudflareContext) — اختياري.
 */
export async function getUsdPerDzdRate(kvOverride?: KvLike | null): Promise<FxRate | null> {
  // 0) القيمة المخزنة الطازة (kvOverride للكرون، وإلا getKv عبر getCloudflareContext)
  let cached: FxRate | null = null;
  try {
    cached = kvOverride
      ? await (async () => {
          const raw = await kvOverride.get(FX_KV_KEY);
          if (!raw) return null;
          try { return JSON.parse(raw) as FxRate; } catch { return null; }
        })()
      : await kvGetJson<FxRate>(FX_KV_KEY);
  } catch {
    cached = null;
  }
  if (cached && validRate(cached.dzdPerUsd) && Date.now() - cached.at < FX_FRESH_MS) {
    return cached;
  }

  // 1+2) الجلب الحي
  const fresh = (await fetchErApi()) ?? (await fetchJsdelivrApi());
  if (fresh) {
    const ok = await kvPutJson(FX_KV_KEY, fresh, FX_KV_TTL_S);
    if (!ok && kvOverride) {
      try { await kvOverride.put(FX_KV_KEY, JSON.stringify(fresh), { expirationTtl: FX_KV_TTL_S }); } catch { /* fail-open */ }
    }
    return fresh;
  }

  // 3) آخر قيمة (حتى قديمة) — أفضل من لا شيء للـ feed
  if (cached && validRate(cached.dzdPerUsd)) return cached;
  return null;
}
