// lib/siteConfigStore.ts — F#93 تخزين كونفيگ الظهور (server-only)
// ═══════════════════════════════════════════════════════════════════════
// ملف واحد للمصدر الحقيقي: نفس bindings تاع الـ Worker اللي خدامين دروك.
//   1) NEXT_INC_CACHE_KV (KV — من nor2)  ← المفضل
//   2) أي KV آخر في env (كشف بالشكل: getWithMetadata)
//   3) NEXT_INC_CACHE_R2_BUCKET / أي R2 (get + put + head)
//   4) dev فقط (NODE_ENV !== 'production'): ملف محلي data/sitecfg.dev.json
//      باش المعاينة المحلية قبل الديبلوي تخدم كاملة — في الإنتاج ميت الكود.
//
// مفتاح واحد: sitecfg:v1 (JSON نصي) — برا مساحة مفاتيح كاش ISR (بلا تصادم).
// كل شي fail-soft: أي فشل = null والمنادي يرجع للـ DEFAULT (المتجر ما يطيحش).
// ⚠️ node:fs كيتستورد dynamically داخل فروع devfile فقط — فروع dev ميتة في
//    الإنتاج (NODE_ENV=production) = الباندل تاع الـ Workers ما ينفذهاش أبداً.
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';

export const SITECFG_KEY = 'sitecfg:v1';
const DEV_FILE_PATH = () => `${process.cwd()}/data/sitecfg.dev.json`;

interface KVLike { get(k: string): Promise<unknown>; put(k: string, v: unknown): Promise<unknown> }
interface Resolved { kind: 'kv' | 'r2' | 'devfile'; ns: unknown }

async function devFs() {
  const fs = await import('node:fs');
  return fs.promises;
}

async function resolveStore(): Promise<Resolved | null> {
  // ─── dev file store — أولاً في التطوير باش المعاينة المحلية تكون حقيقية ───
  if (process.env.NODE_ENV !== 'production') {
    return { kind: 'devfile', ns: null };
  }

  // ─── إنتاج: Workers runtime عبر getCloudflareContext (async — OpenNext 1.x) ───
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    if (!env) return null;

    // 1) الاسم الموثق من nor2
    const preferred = env.NEXT_INC_CACHE_KV;
    if (preferred && typeof (preferred as KVLike).get === 'function' && typeof (preferred as KVLike).put === 'function') {
      return { kind: 'kv', ns: preferred };
    }
    // 2) أي KV آخر (شكل KV = getWithMetadata)
    for (const v of Object.values(env)) {
      if (
        v && typeof (v as KVLike).get === 'function' &&
        typeof (v as KVLike).put === 'function' &&
        typeof (v as Record<string, unknown>).getWithMetadata === 'function'
      ) return { kind: 'kv', ns: v };
    }
    // 3) أي R2 bucket (get + put + head)
    for (const v of Object.values(env)) {
      if (
        v && typeof (v as KVLike).get === 'function' &&
        typeof (v as KVLike).put === 'function' &&
        typeof (v as Record<string, unknown>).head === 'function'
      ) return { kind: 'r2', ns: v };
    }
  } catch {
    // برا Workers runtime (build/standalone) — fail-soft
  }
  return null;
}

async function readRaw(store: Resolved): Promise<string | null> {
  if (store.kind === 'devfile') {
    try { return await (await devFs()).readFile(DEV_FILE_PATH(), 'utf8'); } catch { return null; }
  }
  const ns = store.ns as KVLike;
  const v = await ns.get(SITECFG_KEY);
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof (v as { text?: unknown }).text === 'function') return await (v as { text(): Promise<string> }).text();
  return null;
}

async function writeRaw(store: Resolved, json: string): Promise<void> {
  if (store.kind === 'devfile') {
    const fs = await devFs();
    await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
    await fs.writeFile(DEV_FILE_PATH(), json, 'utf8');
    return;
  }
  const ns = store.ns as KVLike;
  await ns.put(SITECFG_KEY, json);
}

/** القراءة العامة — null = ما كاين شي كونفيگ (المنادي يرجع للـ DEFAULT) */
export async function getStoredSiteConfig(): Promise<unknown | null> {
  const store = await resolveStore();
  if (!store) return null;
  try {
    const raw = await readRaw(store);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** الكتابة الإدارية — ترجع وسيلة التخزين باش الأدمن يشوف الحقيقة */
export async function putStoredSiteConfig(config: unknown): Promise<{ storage: 'kv' | 'r2' | 'devfile' } | null> {
  const store = await resolveStore();
  if (!store) return null;
  try {
    await writeRaw(store, JSON.stringify(config));
    return { storage: store.kind };
  } catch {
    return null;
  }
}

/** الفحص التشخيصي — للـ admin UI (شنو متاح بلا ما نكتبو والو) */
export async function probeStore(): Promise<{ kind: Resolved['kind'] } | null> {
  const store = await resolveStore();
  return store ? { kind: store.kind } : null;
}
