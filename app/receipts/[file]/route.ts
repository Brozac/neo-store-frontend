// GET /receipts/[file] — خدمة إيصالات BaridiMob من R2 MEDIA_BUCKET (مرآة /feeds/[file])
// ═══════════════════════════════════════════════════════════════════════
// · المفاتيح غير قابلة للتخمين: receipts/{yyyyMMdd}-{8 hex}.{ext} — الرابط نفسه هو التصريح
// · سماحية صارمة بالـ regex — كل حاجة أخرى = 404 (بلا traversal ولا تكهن)
// · private + no-store — إيصالات بنكية (PII) ما كاش-يش
// · قراءة الأدمن عملياً (صفحة /admin/baridimob كتعرض order.receipt_url كصورة/تحميل)
import { NextResponse } from 'next/server';
import { getPbRuntime } from '@/lib/pb/pb-env';

export const dynamic = 'force-dynamic';

const FILE_RE = /^[0-9]{8}-[a-f0-9]{8}\.(jpg|png|webp|pdf)$/;
const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  if (!FILE_RE.test(file)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { env } = await getPbRuntime();
  const bucket = env.MEDIA_BUCKET as R2BucketLike | undefined;
  if (!bucket || typeof bucket.get !== 'function') {
    return NextResponse.json({ error: 'Media storage unavailable' }, { status: 503 });
  }

  try {
    const obj = await bucket.get('receipts/' + file);
    if (!obj) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const ext = file.slice(file.lastIndexOf('.') + 1);
    const body = await obj.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPE[ext] || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.warn('[receipts] R2 get failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Storage error' }, { status: 503 });
  }
}
