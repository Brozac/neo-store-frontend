// GET /api/products/[id]/related — Phase F: تحصين (كان fallback على Render)
import { NextResponse } from 'next/server';
import { dbRelated } from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pid = parseInt(id, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json([]);
    }
    const items = await dbRelated(pid);
    return NextResponse.json(items ?? []);
  } catch (e) {
    console.warn('[pb-related] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json([]);
  }
}
