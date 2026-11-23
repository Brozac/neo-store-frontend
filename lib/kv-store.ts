// lib/kv-store.ts — phase-abc: KV accessor موحّد للتوكن/النسخ/الأسعار
// ═══════════════════════════════════════════════════════════════════════
// البند 5 من الـ audit — KV-backed storage بلا إنشاء namespace جديد:
//   · resolver: STORE_KV (إلا زدها المالك لاحقاً) ← NEXT_INC_CACHE_KV (موجود حياً)
//   · النفس NS تاع edge-cache (edgecache:catalog_version) — مفاتيح مسمّاة
//     بـ بادئة واضحة ما كتتعارضش (cj:* · fx:* · feeds:*)
//   · fail-open دائماً: أي فشل KV = null والمنادي كيرجع للسلوك الذاكري
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getPbRuntime } from '@/lib/pb/pb-env';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** KV متاح؟ (مرة لكل نداء — بلا كاش isolate باش التغييرات فالـ config كيتلقاو) */
export async function getKv(): Promise<KvLike | null> {
  try {
    const { env } = await getPbRuntime();
    for (const name of ['STORE_KV', 'NEXT_INC_CACHE_KV']) {
      const kv = env[name] as KvLike | undefined;
      if (
        kv &&
        typeof kv.get === 'function' &&
        typeof kv.put === 'function'
      ) {
        return kv as KvLike;
      }
    }
    return null;
  } catch {
    return null; // build محلي / بلا context — fail-open
  }
}

/** قراءة JSON من KV — null على غياب/فشل/فاسد */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  try {
    const kv = await getKv();
    if (!kv) return null;
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** كتابة JSON في KV — false على فشل (fail-open) */
export async function kvPutJson<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<boolean> {
  try {
    const kv = await getKv();
    if (!kv) return false;
    await kv.put(key, JSON.stringify(value), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
    return true;
  } catch {
    return false;
  }
}

/** bump نسخة edge-cache — نفس مفتاح /api/edge-cache-purge (intra-worker reuse) */
export const EDGE_CACHE_VERSION_KEY = 'edgecache:catalog_version';

export async function bumpEdgeCacheVersion(): Promise<string | null> {
  try {
    const kv = await getKv();
    if (!kv) return null;
    const v = `v${Date.now().toString(36)}`;
    await kv.put(EDGE_CACHE_VERSION_KEY, v);
    return v;
  } catch {
    return null;
  }
}
