// GET /api/products/[id]/related — Phase F: تحصين (كان fallback على Render)
import { NextResponse } from 'next/server';
import { dbRelated } from '@/lib/db-reads';
import { withEdgeCache } from '@/lib/edge-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 🚀 PERF 2026-11-24 — TTL 24h + SWR 7d — نفس عقد الـ purge (bump + zone) للطزاجة
  return withEdgeCache(request, async () => {
    try {
      const { id } = await params;
      const pid = parseInt(id, 10);
      if (!Number.isInteger(pid) || pid <= 0) {
        return NextResponse.json([], {
          headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
        });
      }
      const items = await dbRelated(pid);
      return NextResponse.json(items ?? [], {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      });
    } catch (e) {
      console.warn('[pb-related] failed:', e instanceof Error ? e.message : e);
      return NextResponse.json([]);
    }
  });
}
