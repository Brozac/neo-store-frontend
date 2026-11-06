import { NextResponse } from 'next/server';
import { getServerVisibility } from '@/lib/visibilityServer';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';

// ISR-BUDGET — محتوى ثابت: caching يومي بلا function كل طلبية
export const revalidate = 86400;

// ═══ v28 [total-vanish] — الفروع المخفية ما كيتفهرسوش ═══════════════════
// الطلب ديال المالك: المخفي = «كانها غير موجود ينتحى كامل». الصفحات
// المخفية كيصدهم الـ middleware بـ 404 — فهنا كنحيدهم من الـ sitemap حتى
// Google ما يبقاش كيحاول يفهرس روابط ميتة (crawl budget + trust).
// fail-open: فشل القراءة = الـ sitemap كامل كما كان.
export async function GET() {
  const vis = await getServerVisibility();
  const b = vis.branches;

  const pages = [
    { url: `${SITE_URL}`, priority: '1.0', freq: 'daily', on: true },
    { url: `${SITE_URL}/all-products`, priority: '0.9', freq: 'daily', on: b['all-products'] !== false },
    { url: `${SITE_URL}/categories`, priority: '0.8', freq: 'weekly', on: b['categories'] !== false },
    { url: `${SITE_URL}/track-order`, priority: '0.7', freq: 'monthly', on: b['track-order'] !== false },
    { url: `${SITE_URL}/privacy`, priority: '0.4', freq: 'yearly', on: b['privacy'] !== false },
    { url: `${SITE_URL}/terms`, priority: '0.4', freq: 'yearly', on: b['terms'] !== false },
    { url: `${SITE_URL}/refund`, priority: '0.4', freq: 'yearly', on: b['refund'] !== false },
  ].filter((p) => p.on);

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
