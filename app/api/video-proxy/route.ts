// app/api/video-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ✨ Allowlist بالـ hostname بالضبط — ماشي startsWith
// (startsWith كيتجاوز بـ: https://download-only-api.cjdropshipping.com.evil.com/)
const ALLOWED_HOST = 'download-only-api.cjdropshipping.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // 🛡️ SSRF Defense: parse ثم تحقق من الـ protocol + hostname حرفياً
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    // ✨ تمرير Range — الـ seek/scrub فالمشغل يخدم + تحميل جزئي
    const rangeHeader = req.headers.get('range');

    const upstream = await fetch(videoUrl, {
      headers: {
        'Referer': 'https://developers.cjdropshipping.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      // ✨ timeout 30s — إلا CJ تعطل، الـ route مايعلقش
      signal: AbortSignal.timeout(30000),
    });

    // 206 = Partial Content (رد Range مشروع) — كنقبلوه
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Upstream error', {
        status: upstream.status === 404 ? 404 : 502,
      });
    }

    const headers = new Headers();
    const ct = upstream.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'public, max-age=2592000, immutable, stale-while-revalidate=31536000');
    headers.set('Accept-Ranges', 'bytes');

    // ✨ هيدرات الـ Range — ضروريين للـ 206 باش الـ player يفهم الشرائح
    const contentRange = upstream.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);
    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    // ✨ نرجعو نفس الـ status (200 أو 206) — ماشي 200 صلب
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    // ✨ لوج حقيقي — تقدر تشوف أعطال CJ فـ Vercel Logs
    console.error('[video-proxy] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}