import type { Metadata } from 'next';

// 🩹 SECTION 5 — /track-order صفحة 'use client' → الـ metadata كتخرج من layout
// (النمط الرسمي: page.tsx client + layout.tsx server كيصدّر metadata — بحال exchange/[orderId])
// الصفحة قابلة للفهرسة عمداً: sitemap-static كيوعد بيها بـ priority 0.7 — landing legit لـ "track order laclarc"
export const metadata: Metadata = {
  title: 'Track Your Order',
  description:
    'Track your Laclarc order in real time — live shipping status, courier journey milestones, and estimated delivery for your parcel.',
  alternates: { canonical: '/track-order' },
  openGraph: {
    title: 'Track Your Order | Laclarc',
    description:
      'Track your Laclarc order in real time — live shipping status, courier journey milestones, and estimated delivery for your parcel.',
    url: '/track-order',
  },
};

export default function TrackOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
