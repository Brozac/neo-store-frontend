// app/api/video-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ✨ Allowlist بالـ hostname بالضبط (حماية SSRF — يمتد بـ new URL ولا startsWith)
const ALLOWED_HOSTS = new Set([
  'download-only-api.cjdropshipping.com',           // فيديوهات CJ الحقيقية
  'commondatastorage.googleapis.com',               // فيديوهات الـ Demo (Google Samples)
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // 🛡️ SSRF Defense
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    const rangeHeader = req.headers.get('range');

    const upstream = await fetch(videoUrl, {
      headers: {
        // ✨ الـ Referer ديال CJ فقط مطلوب للـ CJ — للباقيين عادي
        ...(parsed.hostname === 'download-only-api.cjdropshipping.com'
          ? { Referer: 'https://developers.cjdropshipping.com/' }
          : {}),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Upstream error', {
        status: upstream.status === 404 ? 404 : 502,
      });
    }

    const headers = new Headers();
    const ct = upstream.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    headers.set('Accept-Ranges', 'bytes');

    const contentRange = upstream.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);
    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error('[video-proxy] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}