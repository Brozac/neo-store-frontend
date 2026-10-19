import type { Metadata } from 'next';

// 🩹 SECTION 5 — نتائج البحث الداخلي: noindex (نمط جوجل الرسمي لصفحات البحث)
// robots.txt ما كيبلوكيهاش → noindex هو الأداة الصحيحة، و follow:true باش الروابط اللي
// فيها تبقى قابلة للتتبع (الـ crawl equity ما كيضيعش)
export const metadata: Metadata = {
  title: 'Search Results',
  robots: { index: false, follow: true },
};

export default function CjSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
