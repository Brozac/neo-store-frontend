import type { Metadata } from 'next';

// 🩹 SECTION 5 — المفضلة خاصة بكل زبون (local state) → noindex
// robots.txt ما كيبلوكيهاش → noindex كيتشاف فعلياً من جوجل (فعال 100%)
export const metadata: Metadata = {
  title: 'My Favorites',
  robots: { index: false, follow: true },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
