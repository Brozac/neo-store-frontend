// GET /api/products/[id]/related — Phase F: تحصين (كان fallback على Render)
import { NextResponse } from 'next/server';
import { dbRelated } from '@/lib/db-reads';
import { withEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Phase H — المنتجات ذات الصلة: نفس البيانات للجميع · TTL 120s
  return withEdgeCache(request, async () => {
    try {
      const { id } = await params;
      const pid = parseInt(id, 10);
      if (!Number.isInteger(pid) || pid <= 0) {
        return NextResponse.json([], {
          headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
        });
      }
      const items = await dbRelated(pid);
      return NextResponse.json(items ?? [], {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    } catch (e) {
      console.warn('[pb-related] failed:', e instanceof Error ? e.message : e);
      return NextResponse.json([]);
    }
  });
}
