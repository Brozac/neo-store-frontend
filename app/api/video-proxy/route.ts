// app/api/video-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  // أمان: التأكد من أن الرابط يأتي من خوادم CJ فقط لمنع الاستغلال
  if (!videoUrl || !videoUrl.startsWith('https://download-only-api.cjdropshipping.com/')) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    // 1. طلب الفيديو من CJ مع إضافة الهيدر المطلوب
    const response = await fetch(videoUrl, {
      headers: {
        'Referer': 'https://developers.cjdropshipping.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch video', { status: response.status });
    }

    // 2. إعداد الهيدرز لإرسال الفيديو للمتصفح
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
    headers.set('Cache-Control', 'public, max-age=86400'); // كاش لمدة يوم لتقليل الضغط

    // 3. إرجاع تدفق الفيديو (Stream) مباشرة للمتصفح
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}