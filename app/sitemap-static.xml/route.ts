import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';

// ISR-BUDGET — محتوى ثابت: caching يومي بلا function كل طلبية
export const revalidate = 86400;

export async function GET() {
  const pages = [
    { url: `${SITE_URL}`, priority: '1.0', freq: 'daily' },
    { url: `${SITE_URL}/all-products`, priority: '0.9', freq: 'daily' },
    { url: `${SITE_URL}/categories`, priority: '0.8', freq: 'weekly' },
    { url: `${SITE_URL}/track-order`, priority: '0.7', freq: 'monthly' },
    { url: `${SITE_URL}/privacy`, priority: '0.4', freq: 'yearly' },
    { url: `${SITE_URL}/terms`, priority: '0.4', freq: 'yearly' },
    { url: `${SITE_URL}/refund`, priority: '0.4', freq: 'yearly' },
  ];
  // 🩹 SECTION 5 — lastmod مثبت: كان new Date() فكل طلب = lastmod وهمي كيتبدل يومياً،
  //    وجوجل كيوقف الثقة فالتواريخ اللي كتزور دائماً. بدّل يدوياً ملي كيتبدل المحتوى فعلاً.
  const now = '2026-10-19T00:00:00.000Z';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 ${pages.map((p) => `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, s-maxage=86400' },
  });
}