// GET /api/reviews/[productId] — Phase F (مرآة /api/reviews/:productId الأصلي)
// المحليون أولاً (phasef_reviews_local) ثم ريفيوزات CJ (كاش 6h فـ cf-cj)
// ?v2=1 → {reviews, meta} · بلا v2 → array (توافق رجعي)
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { fetchCjReviews } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

interface LocalRow {
  id: number;
  product_id: number;
  author: string;
  rating: number;
  content: string;
  country: string | null;
  images: string[] | null;
  created_at: string;
}

interface CjRow {
  id: string;
  product_id: number;
  author: string;
  rating: number;
  content: string;
  country: string | null;
  images: string[] | null;
  created_at: string;
  source: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const pid = parseInt(productId, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: 'Bad product id' }, { status: 400 });
  }
  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const rows = await sql.unsafe('SELECT phasef_reviews_local($1) AS r', [pid]);
    const local = (rows[0]?.r ?? []) as LocalRow[];

    // ⭐ [cj-reviews] — ريفيوزات CJ (تدهور صامت — المحليون باقيين يخدمو)
    let cjRows: CjRow[] = [];
    let cjTotal = 0;
    try {
      const pidRows = await sql.unsafe(
        'SELECT cj_product_id FROM products WHERE id = $1 LIMIT 1',
        [pid],
      );
      const cjPid = typeof pidRows[0]?.cj_product_id === 'string' ? pidRows[0].cj_product_id : null;
      if (cjPid && !cjPid.startsWith('MANUAL_')) {
        const cj = await fetchCjReviews(cjPid, { size: 50 });
        cjRows = (cj.reviews || []).map((r) => ({
          id: `cj-${r.id}`,
          product_id: pid,
          author: r.name,
          rating: r.score,
          content: r.text,
          country: r.country ?? null,
          images: r.images ?? null,
          created_at: r.date ?? '',
          source: 'cj',
        }));
        cjTotal = cj.total || cjRows.length;
      }
    } catch (e) {
      console.warn('[pb-reviews] cj merge skipped:', e instanceof Error ? e.message : e);
    }

    const merged = [...local, ...cjRows];
    const url = new URL(request.url);
    if (url.searchParams.get('v2') === '1' || url.searchParams.get('v2') === 'true') {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of merged) {
        const k = parseInt(String(r.rating), 10) || 0;
        if (k >= 1 && k <= 5) counts[k] += 1;
      }
      return NextResponse.json({
        reviews: merged,
        meta: {
          total: local.length + cjTotal,
          loaded: merged.length,
          counts,
          local: local.length,
          cj: cjRows.length,
          hasMore: cjTotal > cjRows.length,
        },
      });
    }
    return NextResponse.json(merged);
  } catch (e) {
    console.warn('[pb-reviews] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
