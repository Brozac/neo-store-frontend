// app/api/site-config/route.ts — F#93 باب كونفيگ الظهور (قراءة عامة · كتابة إدارية)
// ═══════════════════════════════════════════════════════════════════════
// GET  — عام: Cache API (60s) → التخزين → دمج مع DEFAULT → JSON + source صادق
// PUT  — أدمن فقط: التحقق بتفويض الجلسة للباك الحي (نفس admin_token cookie
//        كيمر على GET /api/admin/settings → 200 = أدمن حقيقي، 401/403 = رفض)
//        ثم sanitize fail-closed → كتابة → تفريغ الكاش → revalidate للصفحات ISR.
//
// ⛔ صفر endpoints باك جديدة — التخزين في bindings الواجهة (KV/R2 الموجودين).
// كل فشل = استجابة صادقة بstatus صحيح (لا أخضر زائف — Tenet 3).
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/backend-server';
import {
  DEFAULT_CONFIG, sanitizeConfig, type SiteVisibilityConfig,
} from '@/lib/siteConfig';
import { getStoredSiteConfig, putStoredSiteConfig } from '@/lib/siteConfigStore';

export const dynamic = 'force-dynamic';

// ─── Edge Cache (Workers caches.default) — في dev ما كاينش → fail-soft ───
const EDGE_TTL = 60;

async function edgeGet(req: Request): Promise<Response | null> {
  try {
    const cachesAny = (globalThis as any).caches;
    if (!cachesAny?.default) return null;
    return await cachesAny.default.match(req.url) ?? null;
  } catch { return null; }
}

async function edgePut(req: Request, res: Response): Promise<void> {
  try {
    const cachesAny = (globalThis as any).caches;
    if (!cachesAny?.default) return;
    await cachesAny.default.put(req.url, res.clone());
  } catch { /* ignore */ }
}

async function edgePurge(origin: string): Promise<boolean> {
  try {
    const cachesAny = (globalThis as any).caches;
    if (!cachesAny?.default) return false;
    await cachesAny.default.delete(`${origin}/api/site-config`);
    return true;
  } catch { return false; }
}

function withSource(cfg: SiteVisibilityConfig, source: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { config: cfg, source, ...extra },
    { headers: { 'Cache-Control': `public, s-maxage=${EDGE_TTL}, stale-while-revalidate=300` } },
  );
}

export async function GET(req: Request) {
  // 1) الإيدج أول — الزوار ما يحتاجوش يضربو التخزين في كل صفحة
  const hit = await edgeGet(req);
  if (hit) return hit;

  // 2) التخزين → دمج دفاعي مع DEFAULT (أي شكل غالط = القيم الافتراضية للسطح)
  let raw: unknown = null;
  try { raw = await getStoredSiteConfig(); } catch { raw = null; }
  const cfg = sanitizeConfig(raw) ?? { ...DEFAULT_CONFIG };
  const source = raw ? 'store' : 'default';
  const res = withSource(cfg, source, { updatedAt: cfg.updatedAt ?? null });
  await edgePut(req, res);
  return res;
}

export async function PUT(req: Request) {
  // ─── 1. التحقق من الجلسة: نفس كوكي الأدمن كيتفحص عند الباك الحي ───
  try {
    await backendFetch('/api/admin/settings');
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: 'Unauthorized — admin session required' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Cannot verify admin session right now (backend unreachable) — nothing was written' },
      { status: 502 },
    );
  }

  // ─── 2. التحقق من الشكل (fail-closed — أي شكل غالط يرفض كامل) ───
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const incoming = (body as { config?: unknown })?.config ?? body;
  const cfg = sanitizeConfig(incoming);
  if (!cfg) {
    return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 });
  }
  cfg.updatedAt = new Date().toISOString();

  // ─── 3. الكتابة ───
  const stored = await putStoredSiteConfig(cfg);
  if (!stored) {
    return NextResponse.json(
      { error: 'No storage available in this runtime (needs the deployed Worker with KV/R2 bindings) — nothing was written' },
      { status: 503 },
    );
  }

  // ─── 4. تفريغ الكاش + إحياء الصفحات ISR — best-effort مع تقرير صادق ───
  const edgePurged = await edgePurge(new URL(req.url).origin);

  const revalidated: string[] = [];
  const revalidateFailed: string[] = [];
  const revalidations: [string, () => void][] = [
    ['/categories', () => revalidatePath('/categories')],
    ['/category/[slug] (all)', () => revalidatePath('/category/[slug]', 'page')],
    ['/products/[id] (all)', () => revalidatePath('/products/[id]', 'page')],
  ];
  for (const [label, fn] of revalidations) {
    try { fn(); revalidated.push(label); } catch { revalidateFailed.push(label); }
  }

  return NextResponse.json({
    ok: true,
    config: cfg,
    storage: stored.storage,
    edgePurged,
    revalidated,
    revalidateFailed,
    savedAt: cfg.updatedAt,
  });
}
