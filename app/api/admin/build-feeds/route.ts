// POST /api/admin/build-feeds — phase-abc: بناية الـ feeds يدوياً (البند 6)
// ═══════════════════════════════════════════════════════════════════════
// نفس المهلة اللي كيجريها cron "0 3 * * *" — مشغلة يدوياً من اللوحة:
//   · adminGuard (جلسة أدمن + CSRF origin) — نفس نمط sync-single-product
//   · كيقرا الكاتالوگ من Hyperdrive (keyset pagination · صفر OFFSET)
//   · كيرفع feeds/merchant-feed.xml + feeds/merchant-feed-usd.xml إلى MEDIA_BUCKET
//   · الرد: العدادات + المدة — الحد الأقصى ~2-3 دقايق (CPU 30s Paid — كافي:
//     التوليد في Postgres والـ worker pass-through)
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { getPbRuntime } from '@/lib/pb/pb-env';
import { buildAllFeeds } from '@/lib/merchant-feed-r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { env } = await getPbRuntime();
    const result = await buildAllFeeds(env as CfCronEnv);
    return NextResponse.json({
      ok: result.ok,
      rate: result.rate,
      totalMs: result.totalMs,
      dzd: {
        ok: result.dzd.ok,
        items: result.dzd.items,
        bytes: result.dzd.bytes,
        ms: result.dzd.ms,
        skipped: result.dzd.skipped,
      },
      usd: {
        ok: result.usd.ok,
        items: result.usd.items,
        bytes: result.usd.bytes,
        ms: result.usd.ms,
        skipped: result.usd.skipped,
      },
    });
  } catch (e) {
    console.warn('[build-feeds] failed:',
      e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Feed build failed — check logs' }, { status: 502 });
  }
}
