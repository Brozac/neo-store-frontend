// app/robots.ts - Laclarc Search Engine Directives
// F#81: real search engines (Google/Bing) stay allowed;
// SEO-analytics crawlers blocked - they burned the KV ISR cache
// write budget (1,000 writes/day free tier) crawling 74K product pages.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com';

  return {
    rules: [
      {
        userAgent: '*', // allow all search engines
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
          '/exchange',
          '/cancel',
          '/*?*session_id=*', // payment sessions (belt over /success)
        ],
      },
      // F#81: SEO-analytics bots - no ranking value, heavy crawl
      {
        userAgent: [
          'SemrushBot',
          'AhrefsBot',
          'MJ12bot',
          'DotBot',
          'PetalBot',
          'SerpstatBot',
          'BLEXBot',
          'Bytespider',
        ],
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
