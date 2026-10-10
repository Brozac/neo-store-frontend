import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';
const CHUNK = 20000;

// 🆕 Sitemap Index — فهرس قياسي: static + categories + product chunks
// الـ count كيتجلب حياً — chunks جداد كيتضافو أوتوماتيكياً مع نمو الكاتالوغ
export const dynamic = 'force-dynamic';

export async function GET() {
  let productChunks = 1;
  try {
    const res = await fetch(`${BACKEND_URL}/api/products?minimal=1&page=1`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      productChunks = Math.max(1, Math.ceil((data.total || 0) / (data.chunkSize || CHUNK)));
    }
  } catch {
    // fallback — شطوة وحدة على الأقل
  }

  const urls = [
    `${SITE_URL}/sitemap-static.xml`,
    `${SITE_URL}/sitemap-categories.xml`,
    ...Array.from({ length: productChunks }, (_, i) => `${SITE_URL}/products/sitemap/${i}.xml`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 ${urls.map((u) => `  <sitemap>\n    <loc>${u}</loc>\n  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}