import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';
const CHUNK = 20000;

// ISR-BUDGET — كان force-dynamic: كل زحفة ديال Googlebot = function invocation +
// كتابة data-cache. دابا ISR يومي: أقصى كتابة وحدة/يوم لكل chunk
export const revalidate = 86400;

// 🆕 product chunk sitemap — يدوي كامل (بلا generateSitemaps تاع Next اللي كيتخطف)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chunk: string }> }
) {
  const { chunk } = await params;
  const chunkId = Math.max(0, parseInt(chunk, 10) || 0);

  try {
    const res = await fetch(`${BACKEND_URL}/api/products?minimal=1&page=${chunkId + 1}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 ${products.map((p: any) => `  <url>
    <loc>${SITE_URL}/products/${p.id}</loc>
    <lastmod>${p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    console.error('[product-chunk-sitemap]', e);
    return new NextResponse('<?xml version="1.0"?><urlset/>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}