// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.laclarc.com';
  
  return {
    rules: [
      {
        userAgent: '*', // السماح لجميع زواحف جوجل وبنغ
        allow: '/',
        disallow: [
          '/api/',
          '/cart',
          '/admin',
          '/auth',
          '/orders'
        ], // نمنع الأرشفة للصفحات الحساسة أو غير المفيدة للـ SEO
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}