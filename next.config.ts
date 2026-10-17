import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc next.config.ts — v2.0 (Task 10 Review)
 * ═══════════════════════════════════════════════════════════════
 * 🩹 FIX-POWERED — poweredByHeader: false — "X-Powered-By: Next.js"
 *    بصمة مجانية للفينجربرنتينغ. محذوفة.
 * 🩹 FIX-XSS — X-XSS-Protection محذوف: deprecated — المتصفحات الحديثة
 *    تتجاهله كلياً، وقديماته كانت فيها ثغرة XSS-Auditor.
 *    توصية OWASP الحالية: الحذف (أو '0').
 * 🩹 FIX-HSTS — Strict-Transport-Security سنة كاملة + subdomains:
 *    بعد أول زيارة HTTPS، المتصفح يرفض أي http تلقائياً — يقفل
 *    باب downgrade attacks والـ cookie-injection على http.
 * 🩹 FIX-PERMS — Permissions-Policy: كاميرا/مايك/جيو/تتبع-مواضيع = مرفوضة.
 *    (payment تُركت عمداً — لا تعطّل Apple Pay/Stripe إطلاقاً)
 * ───────────────────────────────────────────────────────────────
 * ⚠️ نطاق مهم: هذه الـ headers تخص Next (Vercel) فقط. الباكند على Render
 *    (server.js) يحتاج نفس المجموعة هناك — helmet أو headers يدوية.
 * 🔒 CSP: مؤجلة عن قصد — تفعيلها عمياء يكسر GSAP async + JSON-LD + Stripe.
 *    خريطة التفعيل الآمن (مرحلتين) موثقة أسفل الملف.
 * ───────────────────────────────────────────────────────────────
 * محفوظ كما هو: images.unoptimized:true معمارية مقصودة — OSS transforms في
 * lib/imageOptimizer.ts هي من تحسّن الصور (لا تكاليف/حدود Vercel image
 * optimization على 73,597 منتج)، و/api/img immutable cache جاهز للـ proxy.
 * ═══════════════════════════════════════════════════════════════
 */

const nextConfig: NextConfig = {
  // 🩹 FIX-POWERED
  poweredByHeader: false,

  images: {
    unoptimized: true,
    // 🆕 Mission #17 — qualities مسجلة رسمياً (حماية مستقبلية لانتقال next/image)
    qualities: [40, 75, 80, 90],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '5000' },
      // 🩹 MIGRATION-READY — host الباكند الحقيقي (المكتشف من all-products v2.1)
      // فعّله يوم flip → unoptimized:false (اليوم مع unoptimized:true الـ remotePatterns ما كيتفحصوش أصلاً):
      // { protocol: 'https', hostname: 'neo-store-backend.onrender.com' },
      { protocol: 'https', hostname: '**.cjdropshipping.com' },
      { protocol: 'https', hostname: '**.aliyuncs.com' },
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.aliexpress-media.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  // 🆕 Mission #8 — المصادر المسموحة للصور (صور مُحسّنة من CJ CDN)
  // cached طويلاً على حافة Vercel — زائر ثانٍ = صفر شبكة
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // 🩹 FIX-XSS — محذوف (deprecated):
          // { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 🩹 FIX-HSTS — بعد أول HTTPS: المتصفح يفرض HTTPS سنة كاملة
          //    (includeSubDomains: تأكد أن كل subdomains عندك https قبل الاعتماد)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // 🩹 FIX-PERMS — قفل APIs ما يحتاجهاش الموقع (payment مسموحة عمداً لـ Stripe)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()',
          },
        ],
      },
      {
        // 🆕 Image Beast — if we ever route through our edge proxy
        source: '/api/img/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
          // ⚠️ كي تبني الـ proxy فعلاً: إذا التفاوض على الفورمات حسب Accept
          // (webp/avif) زيد 'Vary: Accept' — وإلا CDN يقدر يخدم webp لمتصفح ما يفهموش.
        ],
      },
    ];
  },

  /*
   * 🔒 CSP — الخريطة كي تحب تفعّلها (خطوتين، بلا كسر):
   *
   * 1) مرحلة المراقبة (أسابيع، صفر تأثير على المستخدم) — أضفها داخل headers()
   *    فوق نفس source '/(.*)':
   *      Content-Security-Policy-Report-Only:
   *        default-src 'self';
   *        img-src 'self' data: https://*.cjdropshipping.com https://*.alicdn.com
   *                https://*.aliyuncs.com https://*.aliexpress-media.com
   *                https://res.cloudinary.com https://images.unsplash.com;
   *        script-src 'self' 'unsafe-inline' https://js.stripe.com;   // جرّد الـ externals الفعلية أولاً
   *        frame-src https://js.stripe.com https://hooks.stripe.com;
   *        connect-src 'self' https://api.stripe.com;
   *        report-uri /api/csp-reports;
   * 2) راقب التقارير أسبوعين → جرّب إزالة 'unsafe-inline' (nonces) → فعّل Enforce.
   *
   * ⚠️ لا تفعّل Enforce مباشرة: GSAP async + JSON-LD + Stripe = inline/external
   *    يحتاج جرد دقيق، وإلا الموقع ينكسر بصمت للزوار.
   */
};

// ──── [LACLARC::SENTRY-NEXTCONFIG] v1 (Task 16) ────
// withSentryConfig — sourcemaps كيرفعو غير إلا كان SENTRY_AUTH_TOKEN فالبيئة
// (Vercel: SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN — اختياريين فالمرحلة 1)
export default withSentryConfig(
  nextConfig,
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    disableLogger: true,
  }
);
// ──── [/LACLARC::SENTRY-NEXTCONFIG] ────
