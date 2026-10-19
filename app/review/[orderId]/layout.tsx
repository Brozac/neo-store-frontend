import type { Metadata } from 'next';

// 🩹 SECTION 5 — صفحة المراجعة مربوطة بـ orderId + token خاص → noindex
// ⚠️ robots.txt ما كيبلوكيهاش، وكانت قابلة للفهرسة بلا حتى title — كل orderId = صفحة
// رقيقة قابلة للفهرسة (thin content × آلاف الطلبات)
export const metadata: Metadata = {
  title: 'Product Review',
  robots: { index: false, follow: true },
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
