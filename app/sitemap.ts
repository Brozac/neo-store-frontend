// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.laclarc.com';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://neo-store-backend.onrender.com';

  // المسارات الثابتة (الصفحة الرئيسية، الفئات، إلخ)
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // جلب جميع المنتجات من السيرفر
  try {
    const res = await fetch(`${backendUrl}/api/products`, {
      next: { revalidate: 3600 } // تحديث كل ساعة
    });
    const products = await res.json();

    // توليد رابط لكل منتج
    const productPages: MetadataRoute.Sitemap = products.map((product: any) => ({
      url: `${baseUrl}/products/${product.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9, // أولوية عالية لصفحات المنتجات
    }));

    return [...staticPages, ...productPages];
  } catch (error) {
    console.error('Failed to generate sitemap:', error);
    return staticPages;
  }
}