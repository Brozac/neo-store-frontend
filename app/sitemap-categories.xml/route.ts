import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';

interface CategoryNode {
  slug?: string;
  children?: CategoryNode[];
}

function flattenCategoryTree(nodes: CategoryNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node?.slug) out.push(node.slug);
    if (Array.isArray(node?.children) && node.children.length > 0) {
      flattenCategoryTree(node.children, out);
    }
  }
  return out;
}

export async function GET() {
  const now = new Date().toISOString();
  let slugs: string[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/categories`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      const tree: CategoryNode[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.children)
          ? data.children
          : [];
      slugs = flattenCategoryTree(tree);
    }
  } catch {
    // fail → urlset خاوي (الفهرس يبقى صالح)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 ${slugs.map((slug) => `  <url>\n    <loc>${SITE_URL}/category/${slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, s-maxage=86400' },
  });
}