import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ضغط تلقائي فائق السرعة للصور بصيغتي WebP و AVIF
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
      {
        protocol: 'https',
        hostname: '**.cjdropshipping.com',
      },
      {
        protocol: 'https',
        hostname: '**.aliyuncs.com',
      },
      {
        protocol: 'https',
        hostname: '**.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.aliexpress-media.com',
      },
      // ✨ إضافة Cloudinary لدعم صور الإيصالات وصور الأدمن والمستخدمين
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // صور الأفاتار والمراجعات المعتمدة
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      }
    ],
  },

  // إزالة جميع رسائل console.log في بيئة الإنتاج للحفاظ على الأداء والسرية
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  // ✨ هيدرز الأمان البنكية لحماية المتجر من الاختراق والتأطير الخبيث (Clickjacking)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;