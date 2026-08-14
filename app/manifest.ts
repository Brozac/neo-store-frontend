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
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable', // ✨ تم التصحيح هنا
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable', // ✨ تم التصحيح هنا
      }
    ],
  };
}