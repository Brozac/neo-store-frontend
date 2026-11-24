// GET /api/products/[id] — Phase F: تحصين مسار DeliveryEstimator (كان على Render)
// نفس projection تاع dbProduct — 404 على الغياب
import { NextResponse } from 'next/server';
import { dbProduct } from '@/lib/db-reads';
import { withEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 🚀 PERF 2026-11-24 — TTL 24h + SWR 7d: الـ 304k نداء WHERE id=$1 كانو بلا كاش فعّال.
  //  الطزاجة عبر bump ديال edgecache:catalog_version (price-sync/admin/webhook) +
  //  zone purge للـ URLs المحدثة — ماشي عبر TTL قصير كيعاود يضرب الـ DB كل دقيقتين.
  return withEdgeCache(request, async () => {
    try {
      const { id } = await params;
      const pid = parseInt(id, 10);
      if (!Number.isInteger(pid) || pid <= 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const p = await dbProduct(pid);
      if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(p, {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      });
    } catch (e) {
      console.warn('[pb-product] failed:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}
