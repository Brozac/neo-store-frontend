import './globals.css';
import { Providers } from './providers';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next';

// ═══════════════════════════════════════════════════════════════════
// 🩹 AUDIT v2.0 — Task 13 (app/layout.tsx)
// FIX-SLASH   — SITE_URL بلا trailing slash → og:url / JSON-LD ما فيهمش // مزدوجة
// FIX-ESCAPE  — JSON-LD كيتحرس < → إغلاق </script> مستحيل (حماية مستقبلية)
// FIX-SEARCH  — SearchAction تحيّد مؤقتاً (target ما متحققش منه + Google حيّدو
//               من 2024) — طريقة الرجوع موثقة فـ README-layout-og-fix.md #2
// DOC-INHERIT — openGraph/twitter كيمرجو shallow — كل صفحة خاصها url ديالها
// ═══════════════════════════════════════════════════════════════════

// ✨ Tenet #4 — مصدر واحد للحقيقة (متسق مع sitemap.ts و robots.ts)
// 🩹 FIX-SLASH — إلا env جات فيها "/" فالآخر → metadataBase والـ JSON-LD
//    كانوا يولّدو example.com//icon-512.png (URL مزدوج = canonical مشوش)
const SITE_URL = (
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com'
).replace(/\/+$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Laclarc | Curated Lifestyle, Electric Grooming & Trending Essentials',
    template: '%s | Laclarc',
  },
  description: 'Discover curated trending gear, electric grooming innovations, and lifestyle essentials at Laclarc Store. Enjoy Free Worldwide Express Shipping and 100% secure checkout.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  // ✨ الإعداد الرسمي المدمج لـ Apple PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Laclarc',
  },
  openGraph: {
    title: 'Laclarc | Premium Lifestyle & Electric Grooming Drops',
    description: 'Explore the latest trending gear and lifestyle essentials with free worldwide delivery.',
    url: SITE_URL,
    siteName: 'Laclarc',
    // 🆕 الصورة الديناميكية — app/opengraph-image.tsx كيرجعها تلقائياً (Next convention)
    // (لا hero-image.jpg — كان غايب من public، والـ dynamic كيولد بلا صيانة)
    locale: 'en_US',
    type: 'website',
    // 📋 DOC-INHERIT (Task 13) — هاد الـ block كيتورث بـ shallow-merge لكل الصفحات:
    // أي صفحة كتعرّف openGraph ديالها وما كتحددش `url` → غادي تاخد SITE_URL (الهوم)!
    // ⚠️ صفحات المنتوجات خاصها openGraph.url + openGraph.images ديالها
    //    (المشاركة فـ WhatsApp/فيسبوك بلا هادشي = كارت الهوم العام — README #4)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laclarc | Premium Lifestyle Store',
    description: 'Explore curated trending items with Free Worldwide Express Shipping.',
    // 🆕 كيورث من opengraph-image تلقائياً — بلا تكرار
    // 📋 DOC-INHERIT — نفس المنطق: الصفحة اللي كتحدد twitter خاصها تحدد الحقول ديالها
    // (اختياري: site: '@handle' — إلا عندك حساب رسمي — README #5)
  },
};

// ✨ zoom متاح — WCAG accessibility
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6B3DB4',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-temu-offwhite font-sans antialiased text-gray-900" suppressHydrationWarning>

        {/* ✨ JSON-LD Structured Data (FIX-ESCAPE مطبق) */}

        <Providers>
          {children}
        </Providers>

        {/* Meta Pixel — ⚡ Phase 3: lazyOnload — التتبع لا يزاحم تفاعل الزبون الأول (INP) */}
        {/* ✓ Task 13: الـ ID منقّى بأرقام فقط [^\d] — ما فيهاش XSS */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="lazyOnload">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${String(process.env.NEXT_PUBLIC_META_PIXEL_ID).replace(/[^\d]/g, '')}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}

        {/* TikTok Pixel — ⚡ Phase 3: lazyOnload (نفس المبدأ) — مجمد فعلياً بلا env */}
        {/* ✓ Task 13: الـ ID منقّى بـ [\w-] — ما فيهاش XSS */}
        {process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID && (
          <Script id="tiktok-pixel" strategy="lazyOnload">
            {`
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._t[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${String(process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID).replace(/[^\w-]/g, '')}');
                ttq.page();
              }(window, document, 'ttq');
            `}
          </Script>
        )}
      </body>
    </html>
  );
}