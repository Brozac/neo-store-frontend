import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';
const CHUNK = 20000;

// 🆕 generateSitemaps — chunk واحد لكل 20k منتج (/products/sitemap/0.xml · 1.xml ...)
export async function generateSitemaps() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/products?minimal=1&page=1`);
    if (!res.ok) return [{ id: 0 }];
    const data = await res.json();
    const chunks = Math.max(1, Math.ceil((data.total || 0) / (data.chunkSize || CHUNK)));
    // buffer +1 — منتجات جداد بين الـ deploys يغطّو
    return Array.from({ length: chunks + 1 }, (_, i) => ({ id: i }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/products?minimal=1&page=${id + 1}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const chunk = Array.isArray(data?.products) ? data.products : [];
    return chunk.map((p: any) => ({
      url: `${SITE_URL}/products/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
  } catch {
    return []; // chunk فاشل = urlset خاوي — الفهرس كيبقى صالح
  }
}