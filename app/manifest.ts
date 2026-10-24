// app/manifest.ts - Laclarc Enterprise PWA Manifest
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Laclarc | Curated Lifestyle & Electric Grooming Innovations',
    short_name: 'Laclarc',
    description: 'Discover trending lifestyle gear, electric grooming innovations, and daily essentials with free worldwide delivery.',
    start_url: '/?homescreen=1',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F8FB',
    theme_color: '#5B7EA6',
    id: '/?homescreen=1', // ✨ مطابق للـ default الضمني — بلا كسر هوية المستخدمين المركبين
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // ✨ نسخة مخصصة بـ safe zone 80% — الشعار مايتقصش فالأيقونات الدائرية
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
    // ✨ اختصارات شاشة الهاتف الرئيسية (Long-press app shortcuts)
    shortcuts: [
      {
        name: 'Track Order',
        short_name: 'Track',
        description: 'Track your live parcel shipment',
        url: '/track-order', // ⚠️ تحقق أن المسار كاين فالـ frontend
        icons: [{ src: '/icon-192.png', sizes: '192x192' }]
      },
      {
        name: 'Lightning Deals',
        short_name: 'Deals',
        description: 'Explore limited-time flash drops',
        url: '/#catalog', // ✅ داخل الـ scope — Chrome كيسكرول للـ anchor عند الإطلاق
        icons: [{ src: '/icon-192.png', sizes: '192x192' }]
      }
    ]
  };
}