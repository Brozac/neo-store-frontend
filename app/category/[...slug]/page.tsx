// app/category/[...slug]/page.tsx - Server Wrapper (SEO Metadata)
import type { Metadata } from 'next';
import CategoryClient from './CategoryClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = (slug[slug.length - 1] || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    // ✨ absolute = كيتجاوز template '%s | Laclarc' — بلا علامة مزدوجة
    title: { absolute: `${name} — Laclarc` },
    description: `Shop curated ${name} products at Laclarc with free worldwide insured shipping.`,
    alternates: { canonical: `/category/${slug.join('/')}` },
  };
}

// ✨ الـ Client كيجيب الـ params بوحدو عبر useParams — ماكانارسلو والو
export default function CategoryPage() {
  return <CategoryClient />;
}