import './globals.css';
import { Providers } from './providers';
import Script from 'next/script';
import Footer from './components/Footer';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://laclarc.com'),
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
  // ✨ الإعداد الرسمي المدمج لـ Apple PWA (يمنع تحذيرات Next.js)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Laclarc',
  },
  openGraph: {
    title: 'Laclarc | Premium Lifestyle & Electric Grooming Drops',
    description: 'Explore the latest trending gear and lifestyle essentials with free worldwide delivery.',
    url: 'https://laclarc.com',
    siteName: 'Laclarc',
    images: [
      {
        url: 'https://laclarc.com/hero-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Laclarc Global Flagship Store',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laclarc | Premium Lifestyle Store',
    description: 'Explore curated trending items with Free Worldwide Express Shipping.',
    images: ['https://laclarc.com/hero-image.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#8B78C6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-temu-offwhite font-sans antialiased text-gray-900" suppressHydrationWarning>
        
        <Providers>
          {children}
        </Providers>

        {/* Meta Pixel (Facebook Ads) */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}

        {/* TikTok Pixel */}
        {process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID && (
          <Script id="tiktok-pixel" strategy="afterInteractive">
            {`
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID}');
                ttq.page();
              }(window, document, 'ttq');
            `}
          </Script>
        )}
        
        <Footer />
      </body>
    </html>
  );
}