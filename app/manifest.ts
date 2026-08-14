import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEO Store - Smart Shopping',
    short_name: 'NEO Store',
    description: 'Discover the best trending products at NEO Store.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F9F8FC',
    theme_color: '#8B78C6',
    // ✨ Next.js سيقرأ الأيقونة من ملف icon.tsx تلقائياً
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      }
    ],
  };
}