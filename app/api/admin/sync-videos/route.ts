// POST /api/admin/sync-videos — Phase I: صيد فيديوهات CJ (bounded 12/نداء)
// phasei_video_pick_missing(12) → /product/queryVideosByProductId → phasei_video_apply
// الأولوية: has_video=true بلا URL (CJ مؤكد) — الأكثر مبيعاً أولاً
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

const BATCH = 12;

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const picked = await withDb((sql) => callFn(sql, 'phasei_video_pick_missing', [BATCH]));
  if (picked === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
  const targets = Array.isArray(picked) ? (picked as { pid?: string }[]) : [];
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, message: 'No missing videos — all covered.' });
  }

  let applied = 0;
  let missed = 0;
  for (const t of targets) {
    const pid = String(t?.pid ?? '');
    if (!pid) continue;
    try {
      const res = await cjFetch('/product/queryVideosByProductId', {
        method: 'POST',
        body: { productId: pid },
      });
      const env = res.data as { code?: number; data?: { videoUrl?: string; videoState?: string }[] | null } | null;
      const data = env?.code === 200 ? env?.data ?? null : null;
      const vid = Array.isArray(data)
        ? data.find((v) => v?.videoUrl && (!v.videoState || v.videoState === 'ON_STATE'))
        : null;
      if (!vid?.videoUrl) {
        missed += 1;
        continue;
      }
      const r = await withDb((sql) => callFn(sql, 'phasei_video_apply', [pid, vid.videoUrl as string]));
      if (r?.ok === true) applied += 1;
      else missed += 1;
    } catch {
      missed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Video sync batch done — applied: ${applied}, missing: ${missed}, scanned: ${targets.length}.`,
  });
}
