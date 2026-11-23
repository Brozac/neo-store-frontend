// GET /api/merchant-feed-usd.xml — phase-abc: alias legacy (301) للـ feed USD
// الرابط الجديد: https://laclarc.com/feeds/merchant-feed-usd.xml
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect('https://laclarc.com/feeds/merchant-feed-usd.xml', {
    status: 301,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
