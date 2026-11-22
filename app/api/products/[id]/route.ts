// GET /api/products/[id] — Phase F: تحصين مسار DeliveryEstimator (كان على Render)
// نفس projection تاع dbProduct — 404 على الغياب
import { NextResponse } from 'next/server';
import { dbProduct } from '@/lib/db-reads';
import { withEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Phase H — تفاصيل المنتج للجمهور: نفس البيانات للجميع · TTL 120s (الثمن يتجدد ≤2د)
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
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    } catch (e) {
      console.warn('[pb-product] failed:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}
