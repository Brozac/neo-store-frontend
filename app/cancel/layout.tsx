import type { Metadata } from 'next';

// 🩹 SECTION 5 — صفحة إلغاء الدفع: noindex حزام أمان (نفس منطق success/layout.tsx)
export const metadata: Metadata = {
  title: 'Order Canceled',
  robots: { index: false, follow: true },
};

export default function CancelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
