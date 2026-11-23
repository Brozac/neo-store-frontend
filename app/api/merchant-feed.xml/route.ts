// GET /api/merchant-feed.xml — phase-abc: alias legacy (301) للـ feed DZD
// Google Merchant قد يحتفظ بعناوين قديمة على api.laclarc.com — الرابط الجديد:
//   https://laclarc.com/feeds/merchant-feed.xml
// redirect ثابت + Cache-Control قصير (الـ middleware كيفرض no-store على /api/*
// — redirect خفيف، ما كيحتاجش كاش)
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect('https://laclarc.com/feeds/merchant-feed.xml', {
    status: 301,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
