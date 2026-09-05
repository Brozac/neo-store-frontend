// app/sitemap.ts - Laclarc Automated Dynamic Sitemap
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';

  // 1. الصفحات الأساسية والصفحات القانونية الموثوقة لـ Google
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/track-order`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/refund`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];

  // 2. جلب وتوليد روابط الأقسام الديناميكية
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const catRes = await fetch(`${backendUrl}/api/categories`, {
      next: { revalidate: 86400 } // تحديث يومي
    });
    if (catRes.ok) {
      const categories = await catRes.json();
      if (Array.isArray(categories)) {
        categoryPages = categories.map((cat: any) => ({
          url: `${baseUrl}/category/${cat.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        }));
      }
    }
  } catch (catErr) {
    console.warn('Sitemap: Category fetch fallback');
  }

  // 3. جلب وتوليد روابط المنتجات بأمان
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${backendUrl}/api/products`, {
      next: { revalidate: 3600 } // تحديث كل ساعة
    });
    
    if (res.ok) {
      const products = await res.json();
      // ✨ حماية ضد انهيار map في حال كان الرد ليس مصفوفة
      if (Array.isArray(products)) {
        productPages = products.map((product: any) => ({
          url: `${baseUrl}/products/${product.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.9,
        }));
      }
    }
  } catch (error) {
    console.error('Sitemap: Product fetch fallback', error);
  }

  return [...staticPages, ...categoryPages, ...productPages];
}