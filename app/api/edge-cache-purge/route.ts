// ═══════════════════════════════════════════════════════════════
// Phase H v2 — purge فوري لكاش الحافة عند تعديل الكاطالوگ
// ═══════════════════════════════════════════════════════════════
// المنادي:
//   1) لوحة الأدمن (app/utils/adminApi.ts interceptor) بعد كل تعديل
//      ناجح على الكاطالوگ — جلسة أدمن (كوكي admin_token).
//   2) أي خدمة داخلية بالمفتاح المشترك (X-PhaseC-Key) — نفس حرس
//      phasec-db (مثلاً rpc مستقبلاً بلا تعديل Rust).
//
// واش كيدير (بالترتيب، كل وحدة fail-open بوحدها):
//   a) bump KV edgecache:catalog_version → مفاتيح Cache API ديال
//      lib/edge-cache.ts كتبدل فوراً (طبقة الـ Worker تفقى).
//   b) CF purge_cache بالـ URLs الدقيقة المتأثرة → zone cache
//      (الطبقة اللي قدام الـ Worker) تفقى للمنتجات/الأقسام المعدلة.
//      بلا EDGE_PURGE_API_TOKEN → نقطو هاد الخطوة (TTL هو شبكة الأمان).
//   c) revalidateTag للـ HTML تاع ISR (نفس نمط visibility-revalidate)
//      — صفحة المنتج/الشجرة كتعاود تتولد عند أول طلب.
//
// اللي ما كيتporteش: القوائم /api/products?page=N (ما يمكنش تعداد
// 2265 صفحة) — تبقى محكومة بالـ TTL (60-600s) كالعادة.
//
// ⚠️ الأمان: auth إجبارية — بلا جلسة أدمن وبلا مفتاح → 401 دائماً.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { backendFetch } from '@/lib/backend-server';

export const dynamic = 'force-dynamic';

// معرفات غير سرية (كتبان فكل نداء CF API) — zone laclarc.com
const CF_ZONE_ID = '234ef6b0c01d0cb85553852a4d0b79a3';
const ORIGINS = ['https://laclarc.com', 'https://www.laclarc.com'];
const VERSION_KV_KEY = 'edgecache:catalog_version';

interface PurgeBody {
  path?: string;      // مسار rpc اللي تدار فيه التعديل (/admin/update-product/123)
  productId?: number; // اختياري — إلا التعديل فbody ماشي فURL (sync-single-product)
  files?: string[];   // 🩹 Phase I incident — URLs صريحة للاستجابة للحوادث (origin-locked)
}

// ─── auth: جلسة أدمن ولا مفتاح الجسر ─────────────────────────
async function authorized(req: Request): Promise<boolean> {
  const bridge = (process.env.PHASEC_BRIDGE_KEY || '').trim();
  if (bridge && (req.headers.get('x-phasec-key') || '') === bridge) return true;
  try {
    await backendFetch('/api/admin/settings', { auth: true }); // 🩹 F-M2 — نفس حرس visibility-revalidate
    return true;
  } catch {
    return false; // بلا جلسة صالحة ولا مفتاح → مرفوض (fail-closed)
  }
}

// ─── استخراج معرف المنتج من المسار ───────────────────────
function productIdFromPath(path: string): number | null {
  const m = path.match(/\/admin\/(?:update-product|delete-product|toggle-deal|videos)\/(\d{1,10})$/);
  return m ? Number(m[1]) : null;
}

// ─── bump نسخة الكاش فالـ KV ─────────────────────────────────
async function bumpVersion(): Promise<string | null> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const kv = env?.NEXT_INC_CACHE_KV as
      | { put?: (key: string, value: string) => Promise<void> }
      | undefined;
    if (!kv || typeof kv.put !== 'function') return null;
    const v = `v${Date.now().toString(36)}`;
    await kv.put(VERSION_KV_KEY, v);
    return v;
  } catch {
    return null; // fail-open — TTL هو شبكة الأمان
  }
}

// ─── CF purge بالـ URLs الدقيقة (zone cache — الطبقة القدامية) ───
async function purgeZoneFiles(urls: string[]): Promise<number> {
  const token = (process.env.EDGE_PURGE_API_TOKEN || '').trim();
  const files = urls.slice(0, 30); // حد CF API: 30 URL/نداء
  if (!token || files.length === 0) return 0;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    const j = (await r.json().catch(() => null)) as { success?: boolean } | null;
    return j?.success === true ? files.length : 0;
  } catch {
    return 0; // fail-open
  }
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: PurgeBody = {};
  try {
    body = (await req.json()) as PurgeBody;
  } catch {
    body = {}; // بلا body — bump عام برك
  }
  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '';

  // ─── (a) bump النسخة — دايماً ───
  const version = await bumpVersion();

  // ─── (b) الـ URLs الدقيقة حسب التعديل ───
  const files: string[] = [];
  const id = Number(body.productId) > 0
    ? Number(body.productId)
    : productIdFromPath(path);
  if (id !== null && Number.isInteger(id)) {
    for (const origin of ORIGINS) {
      files.push(`${origin}/api/products/${id}`, `${origin}/api/products/${id}/related`);
    }
  }
  // الأقسام — شجرة وحدة فقط
  if (/\/admin\/(update-category|sync-categories|backfill-categories|auto-categorize)\b/.test(path)) {
    for (const origin of ORIGINS) files.push(`${origin}/api/categories`);
  }

  // 🩹 Phase I incident — purge صريح بـ URLs مطلوبة (لا origins أخرى · حد 30 · dedup)
  if (Array.isArray(body.files)) {
    for (const f of body.files) {
      if (typeof f === 'string' && f.length <= 400 &&
          /^https:\/\/(www\.)?laclarc\.com\//.test(f)) {
        files.push(f);
      }
    }
  }
  const uniqueFiles = [...new Set(files)].slice(0, 30);
  const purged = await purgeZoneFiles(uniqueFiles);

  // ─── (c) revalidateTag للـ HTML (ISR) — نفس نمط visibility-revalidate ───
  const tags: string[] = [];
  if (id !== null && Number.isInteger(id)) tags.push(`product-${id}`, 'products-index');
  if (/\/admin\/(update-category|sync-categories|backfill-categories|auto-categorize)\b/.test(path)) {
    tags.push('categories-tree');
  }
  for (const tag of tags) {
    try { revalidateTag(tag, 'max'); } catch { /* ISR اختياري — ما يوقفش الpurge */ }
  }

  return NextResponse.json({
    ok: true,
    version,
    purged,
    files: uniqueFiles,
    tags,
  });
}

// GET ممنوع — الpurge كيتما عبر POST فقط
export async function GET() {
  return NextResponse.json({ ok: false, error: 'POST only' }, { status: 405 });
}
