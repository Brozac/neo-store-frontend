import type { Metadata } from 'next';

// 🩹 SECTION 5 — /all-products صفحة 'use client' → الـ metadata كتخرج من layout
// ثاني أهم صفحة فالـ sitemap (priority 0.9) وكانت كتورث title الهوم + og:url الهوم!
// canonical مثبت على المسار النقي: أي ?sort=/?page= كيتحولو كاملين لهنا (تمهيد للقسم 6)
export const metadata: Metadata = {
  title: 'All Products',
  description:
    'Browse every product on Laclarc — trending gear, electric grooming, home, and lifestyle essentials with free worldwide express shipping.',
  alternates: { canonical: '/all-products' },
  openGraph: {
    title: 'All Products | Laclarc',
    description:
      'Browse every product on Laclarc — trending gear, electric grooming, home, and lifestyle essentials with free worldwide express shipping.',
    url: '/all-products',
  },
};

export default function AllProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
