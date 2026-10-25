import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

// ═══ 🔐 ISR-BUDGET — Webhook ديال الطزاجة الفورية (on-demand revalidation) ═══
//
// علاش موجود: Hobby ديال Vercel طافي بـ ISR writes (235K/200K) حيت كل صفحة منتج
// كانت كتولّد مرة كل ساعة. دابا الـ revalidate الزمني = 24h، وهذا الـ endpoint
// كيخلي الباك (CJ sync ولا تعديل يدوي فالأدمن) يحدّث غير اللي تبدّل — بصح.
//
// الاستعمال (من الباك ولا من أي سكريبت ديالك):
//   POST https://laclarc.com/api/revalidate
//     header:  x-revalidate-secret: <REVALIDATE_SECRET>
//     body:    { "tags": ["product-96454", "products-index"], "paths": ["/categories"] }
//   ولا GET بقيم query (ساهل للـ curl):
//     GET  /api/revalidate?secret=<...>&tags=product-96454,products-index&path=/categories
//
// الوسوم المتاحة فالكود:
//   product-<id>     → صفحة منتج واحد بالضبط
//   products-index   → كل الـ related products
//   categories-tree  → شجرة الأقسام + SEO ديالهم
//
// ⚠️ أمان: بلا REVALIDATE_SECRET فالـ env → الـ endpoint مقفول كامل (403 دائماً).
export const dynamic = 'force-dynamic';

function secretOk(provided: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const provided =
    req.headers.get('x-revalidate-secret') || url.searchParams.get('secret');

  if (!secretOk(provided)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized — REVALIDATE_SECRET ماحدّدتش ولا غالط' },
      { status: 403 }
    );
  }

  // body اختياري (POST) — نفس مفاتيح الـ query: tags / paths
  let bodyTags: string[] = [];
  let bodyPaths: string[] = [];
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (Array.isArray(body?.tags)) bodyTags = body.tags.map(String);
      if (Array.isArray(body?.paths)) bodyPaths = body.paths.map(String);
      if (typeof body?.tag === 'string') bodyTags.push(body.tag);
      if (typeof body?.path === 'string') bodyPaths.push(body.path);
    } catch {
      // بلا JSON صالح — نكملو بالـ query
    }
  }

  const qTags = (url.searchParams.get('tags') || url.searchParams.get('tag') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const qPaths = (url.searchParams.get('paths') || url.searchParams.get('path') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tags = [...new Set([...bodyTags, ...qTags])].slice(0, 50);
  const paths = [...new Set([...bodyPaths, ...qPaths])].slice(0, 50);

  if (!tags.length && !paths.length) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'حط tag ولا path: ?tags=product-96454,products-index&path=/categories',
      },
      { status: 400 }
    );
  }

  const done: string[] = [];
  try {
    for (const t of tags) {
      // Next 16: profile إجباري — 'max' = إبطال فوري بلا stale window
      revalidateTag(t, 'max');
      done.push(`tag:${t}`);
    }
    for (const p of paths) {
      revalidatePath(p);
      done.push(`path:${p}`);
    }
  } catch (e) {
    console.error('[revalidate-webhook]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  console.log(`[revalidate-webhook] ✓ ${done.join(', ')}`);
  return NextResponse.json({ ok: true, revalidated: done });
}

export { handle as GET, handle as POST };
