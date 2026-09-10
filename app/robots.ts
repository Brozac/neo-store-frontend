// app/robots.ts - Laclarc Search Engine Directives
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';

  return {
    rules: [
      {
        userAgent: '*', // السماح لجميع محركات البحث العالمية
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/auth',
          '/auth/',
          '/cart',
          '/checkout',
          '/orders',
          '/profile',
          '/success',
          '/cancel',
          '/*?*session_id=*', // جلسات الدفع (غطاء إضافي فوق /success)
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}