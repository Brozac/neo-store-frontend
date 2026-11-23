// lib/pb/pb-env.ts — Phase B: access to Cloudflare runtime (env + waitUntil)
// نفس النمط المثبت في lib/db-ro.ts (F106) — getCloudflareContext({async:true})

export interface PbRuntime {
  env: Record<string, unknown>;
  waitUntil: (p: Promise<unknown>) => void;
}

/**
 * كيرجع env + waitUntil من الـ runtime ديال Workers.
 * خارج Workers (build محلي) → env فارغ + waitUntil noop.
 */
export async function getPbRuntime(): Promise<PbRuntime> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const cf = await mod.getCloudflareContext({ async: true });
    const env = (cf?.env ?? {}) as Record<string, unknown>;
    const ctx = (cf as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)?.ctx;
    return {
      env,
      waitUntil: (p: Promise<unknown>) => {
        try { ctx?.waitUntil?.(p); } catch { /* noop خارج Workers */ }
      },
    };
  } catch {
    return { env: {}, waitUntil: () => {} };
  }
}

export function pbVar(env: Record<string, unknown>, key: string): string | undefined {
  const v = env[key];
  if (typeof v === 'string' && v) return v;
  const p = process.env[key];
  return typeof p === 'string' && p ? p : undefined;
}
