// ═══════════════════════════════════════════════════════════════════════
// F108 — /api/img-report — بلاغ الصور الميتة من زبناء حقيقيين (حماية 3 من 3)
// ═══════════════════════════════════════════════════════════════════════
// GlobalImgFallback (حماية 1) كيخبّي الصورة المكسورة بالـ placeholder وكيجمع
// الـ URLs الميتة فالمتصفح. هاد الـ endpoint هو محطة الاستقبال:
//   → تحقق صارم من الجسم (حدود صريحة، بلا كتابة فشي مكان)
//   → dedupe فالذاكرة (كل isolate): نفس URL ≤ 3 logs — wrangler tail نظيف
//   → log منظم JSON سطر واحد: {evt:'IMG_DEAD', url, n, page, ua, ts}
//     كيبان فـ `wrangler tail` / أي Logpush مستقبلاً
//
// علاش بلا KV/DB؟ NEXT_INC_CACHE_KV هي كاش ISR ديال OpenNext — ما نبلويهاش
// ببيانات app، والـ DB كيتقرا RO من الفرونت. IMG-HEALTH (cron يومي 08:30،
// حماية 2) هو مصدر الحقيقة للمالك بهاد السكريبت العكسي (سامبل GET فعلي).
//
// الحماية: fail-open دايماً — بلاغ صور ماشي حياة أو موت، أي خطأ → 204.
// ═══════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SEEN_CAP = 1000;        // سقف الذاكرة لكل isolate
const MAX_LOGS_PER_URL = 3;   // بعد 3 logs لنفس URL فنفس isolate — سكت
const MAX_BODY = 64_000;      // ~50 report × ~1.3KB — الرسمي أقل بزاف
const MAX_REPORTS = 50;

const seen = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > MAX_BODY) return new NextResponse(null, { status: 204 });

    let body: { reports?: unknown; page?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const reports = body?.reports;
    if (!Array.isArray(reports) || reports.length === 0 || reports.length > MAX_REPORTS) {
      return new NextResponse(null, { status: 204 });
    }

    const ua = (req.headers.get('user-agent') || '').slice(0, 200);
    const page = typeof body.page === 'string' ? body.page.slice(0, 300) : '';
    const ts = new Date().toISOString();

    for (const r of reports) {
      if (!r || typeof r !== 'object') continue;
      const url = typeof (r as { url?: unknown }).url === 'string' ? (r as { url: string }).url : '';
      if (!url || url.length > 2048 || !/^https?:\/\//i.test(url)) continue;

      const nRaw = (r as { n?: unknown }).n;
      const n =
        typeof nRaw === 'number' && Number.isFinite(nRaw)
          ? Math.min(Math.max(Math.round(nRaw), 1), 10_000)
          : 1;

      const prev = seen.get(url) || 0;
      if (prev >= MAX_LOGS_PER_URL) continue;
      seen.set(url, prev + 1);

      // 🩹 console.error ماشي console.log — next.config.ts كيحيد console.*
      // فالإنتاج (removeConsole exclude:['error']) — error هو الوحيد الباقي
      console.error(JSON.stringify({ evt: 'IMG_DEAD', url, n, page, ua, ts, src: 'client' }));
    }

    // housekeeping — الفائض القديم (insertion order = الأقدم أولاً)
    if (seen.size > SEEN_CAP) {
      for (const k of Array.from(seen.keys()).slice(0, seen.size - SEEN_CAP)) seen.delete(k);
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    // fail-open — حتى خطأ ما يرجع 5xx (الـ client ما كيتوقعش جواب أصلاً)
    return new NextResponse(null, { status: 204 });
  }
}
