import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';

interface CategoryNode {
  slug?: string;
  children?: CategoryNode[];
}

// 🩹 S4 FIX — كان كيدفع slug مبسط (سمية العقدة برك): /category/automobiles-sensors
//    هاد الروابط (667 من 681) كيشيرو لصفحات بـ 0 منتج — المسار الحقيقي هو
//    المسار الكامل من الجذر: /category/automobiles-and-motorcycles/auto-replacement-parts/automobiles-sensors
//    (مُثبت حياً: full=91 منتج · flat=0 — probe ديال 2026-10-19)
function collectFullPaths(nodes: CategoryNode[], prefix = '', out: string[] = []): string[] {
  for (const node of nodes || []) {
    if (!node?.slug) continue;
    const path = prefix ? `${prefix}/${node.slug}` : node.slug;
    out.push(path);
    if (Array.isArray(node?.children) && node.children.length > 0) {
      collectFullPaths(node.children, path, out);
    }
  }
  return out;
}

export async function GET() {
  const now = new Date().toISOString();
  let paths: string[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/categories`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      const tree: CategoryNode[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.children)
          ? data.children
          : [];
      paths = collectFullPaths(tree);
    }
  } catch {
    // fail → urlset خاوي (الفهرس يبقى صالح)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 ${paths.map((path) => `  <url>\n    <loc>${SITE_URL}/category/${path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, s-maxage=86400' },
  });
}
