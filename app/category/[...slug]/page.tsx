// app/category/[...slug]/page.tsx - Server Wrapper (SEO Metadata + Content)
// Task 21-e: كيقرا seo_title / seo_h1 / seo_content / seo_faqs من القاعدة
// (عبر /api/categories/seo من الباكند) مع fallback كامل للسلوك القديم.
import type { Metadata } from 'next';
import CategoryClient from './CategoryClient';
import CategorySeoFooter from './CategorySeoFooter';
import { fetchCategorySeo } from '@/lib/categorySeo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.join('/');
  const name = (slug[slug.length - 1] || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // 🎯 العنوان الحقيقي من القاعدة (681 قسم مُحقنين) — إلا فشل: السلوك القديم
  const seo = await fetchCategorySeo(slugPath);
  const title = seo?.seo_title || `${name} — Laclarc`;
  const description =
    seo?.seo_meta_description ||
    `Shop curated ${name} products at Laclarc with free worldwide insured shipping.`;
  return {
    // ✨ absolute = كيتجاوز template '%s | Laclarc' — بلا علامة مزدوجة
    title: { absolute: title },
    description,
    alternates: { canonical: `/category/${slugPath}` },
    openGraph: { title, description, type: 'website' },
  };
}

// ✨ الـ SEO كيتجاب مرة واحدة (React cache + Data Cache ساعة) وكيتمرر للعرض
export default async function CategoryPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const seo = await fetchCategorySeo(slug.join('/'));
  return (
    <>
      <CategoryClient h1Text={seo?.seo_h1 || null} />
      {seo && <CategorySeoFooter content={seo.seo_content || null} faqs={seo.seo_faqs ?? null} />}
    </>
  );
}
