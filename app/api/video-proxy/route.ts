// app/api/video-proxy/route.ts — v2
// v2: فحص الوجهة النهائية بعد redirects (SSF bypass) · Content-Type video/* · host الديمو معلّق
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'download-only-api.cjdropshipping.com',           // فيديوهات CJ
  // ⚠️ probe الـ SQL يحدد إن كان CJ كيوجه لـ CDN — يُضاف هنا بعد البرهان
  // 'commondatastorage.googleapis.com',            // demo فقط (dev) — مقفول في الإنتاج بعد P0
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) return new NextResponse('Missing url parameter', { status: 400 });

  let parsed: URL;
  try { parsed = new URL(videoUrl); } catch { return new NextResponse('Invalid URL', { status: 400 }); }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    const rangeHeader = req.headers.get('range');

    const upstream = await fetch(videoUrl, {
      headers: {
        ...(parsed.hostname === 'download-only-api.cjdropshipping.com'
          ? { Referer: 'https://developers.cjdropshipping.com/' }
          : {}),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    // 🔒 v2: fetch كيتبع 3xx لأي host — الوجهة النهائية خاصها فحصها الخاص
    if (!ALLOWED_HOSTS.has(new URL(upstream.url).hostname)) {
      console.error('[video-proxy] Redirect blocked →', upstream.url);
      return new NextResponse('Redirect target not allowed', { status: 502 });
    }

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status === 404 ? 404 : 502 });
    }

    const ct = upstream.headers.get('Content-Type') || '';
    if (ct && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
      return new NextResponse('Not a video resource', { status: 415 });
    }

    const headers = new Headers();
    if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    headers.set('Accept-Ranges', 'bytes');
    const contentRange = upstream.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);
    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    console.error('[video-proxy] Error:', e);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}