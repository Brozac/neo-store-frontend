import type { Metadata } from 'next';

// 🩹 SECTION 6 — صفحات CJ الحية: noindex,follow
// المشكل: /cj-search (crawlable) كيربط بـ <a href> حقيقية لـ /cj-product/[pid]
//         → جوجل كيقدر يتبعها = آلاف صفحات رقيقة (thin) من داتا CJ الحية
//         بحال باغ /review اللي شفيناه فالقسم 5
// القرار: noindex (ماشي robots.txt block) — باش جوجل يشوف الـ noindex
//         و follow:true باش يحافظ على التتبع ديال الروابط الأخرى
export const metadata: Metadata = {
  title: 'Product',
  robots: { index: false, follow: true },
};

export default function CjProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
