import type { Metadata } from 'next';

// 🩹 SECTION 5 — صفحة ما بعد الشراء: noindex حزام أمان
// robots.txt كيبلوكي /success من قبل (ما كيشوفوش جوجل) — هاد الـ noindex كيخدم:
// 1) محركات أخرى ما كتحترمش robots.txt  2) حماية إلا تبدل سياسة robots فالقسم 6
export const metadata: Metadata = {
  title: 'Order Confirmation',
  robots: { index: false, follow: true },
};

export default function SuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
