// app/categories/page.tsx — Section 4: Hub ديال الأقسام (SEO)
//
// قبل (baseline 2026-10-19 على laclarc.com/categories):
//   'use client' + fetch فالـ mount → الـ SSR كان كيخرج spinner برك:
//   0 رابط قسم · 0 h1 · بلا canonical · بلا JSON-LD · عنوان افتراضي عام
//   → Google كان كيشوف صفحة خاوية (لجنة الفهرسة ما عندها ما تأكل).
//
// دابا:
//   • Server Component + ISR (revalidate 21600 = 6 سوايع)
//   • 681 رابط قسم كاملين فالـ HTML الأول (روابط داخلية — هدف القسم 4)
//   • counts حقيقية من DB (نفس سيمانتيك العدّاد الحي) — بلا counts إلا الباكند
//     رجع الشجرة العادية (سُلّم fallback فـ lib/categoriesHub.ts)
//   • generateMetadata كاملة (title + description + canonical + OG)
//   • CollectionPage JSON-LD (client component — الدرس M#60)
//   • فشل كامل؟ → CategoriesClient (السلوك القديم — الطوارئ)
import type { Metadata } from 'next';
import Link from 'next/link';
import CategoriesClient from './CategoriesClient';
import CategoriesJsonLd from './CategoriesJsonLd';
import { fetchCategoriesHub, type HubNode } from '@/lib/categoriesHub';

// ISR — الأقسام كيتبدلو نادراً؛ 6 سوايع = توازن بين الطزاجة وحمل Render
export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  // أعداد حقيقية معروفة غير بعد الـ fetch — العنوان/الوصف ثابتين وخايبين
  // على أي حالة (بلا وعود بالأرقام — قاعدة الصدق DRS)
  const title = 'Browse All Categories — Laclarc';
  const description =
    'Browse every Laclarc department in one place — electronics, home, beauty, sports and more. Pick a category and start shopping.';
  return {
    // ✨ absolute = كيتجاوز template '%s | Laclarc' — بلا علامة مزدوجة
    title: { absolute: title },
    description,
    alternates: { canonical: '/categories' },
    openGraph: { title, description, type: 'website' },
  };
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function RootSection({ node }: { node: HubNode }) {
  return (
    <section className="bg-white rounded-2xl p-6 border border-fog-100 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        {node.image_url && (
          // صورة تمثيلية من الباكند (نفس نمط /api/categories) — below the fold → lazy
          <img
            src={node.image_url}
            alt={node.name}
            loading="lazy"
            width={56}
            height={56}
            className="w-14 h-14 rounded-xl object-cover bg-fog-50 ring-1 ring-fog-100 flex-shrink-0"
          />
        )}
        <div>
          <Link
            href={`/category/${node.slugPath}`}
            className="text-xl sm:text-2xl font-black text-temu-black hover:text-fog-600 transition cursor-pointer active:scale-95 touch-manipulation inline-block w-fit"
          >
            {node.name}
          </Link>
          {node.count !== null && (
            <p className="text-temu-gray-light text-xs font-semibold mt-0.5">
              {fmt(node.count)} products
            </p>
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {node.children.map((sub) => (
            <div key={sub.id || sub.slug} className="flex flex-col">
              <Link
                href={`/category/${sub.slugPath}`}
                className="text-sm font-bold text-temu-black hover:text-fog-600 transition cursor-pointer mb-2 active:scale-95 touch-manipulation w-fit"
              >
                {sub.name}
              </Link>

              {sub.children.length > 0 && (
                <div className="space-y-1.5">
                  {sub.children.map((leaf) => (
                    <Link
                      key={leaf.id || leaf.slug}
                      href={`/category/${leaf.slugPath}`}
                      className="text-xs text-temu-gray-text hover:text-fog-600 transition cursor-pointer block active:scale-95 touch-manipulation w-fit"
                    >
                      {leaf.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CategoriesPage() {
  const hub = await fetchCategoriesHub();

  // سُلّم fallback وصل لقاعه — السلوك القديم أحسن من صفحة خاوية
  if (!hub) {
    return <CategoriesClient />;
  }

  // عدد الأقسام: من الباكند إلا جا، وإلا الحساب من الشجرة (نفس النتيجة)
  const totalCategories =
    hub.totals?.categories ??
    hub.nodes.reduce(
      (sum, root) =>
        sum +
        1 +
        root.children.length +
        root.children.reduce((a, b) => a + b.children.length, 0),
      0
    );
  const totalProducts = hub.totals?.products ?? null;

  return (
    <main className="min-h-screen pb-24 font-sans">
      <div className="max-w-7xl mx-auto p-6">

        <Link
          href="/"
          className="flex items-center gap-1.5 text-fog-600 font-bold text-sm mb-6 cursor-pointer z-10 relative active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-10 mt-4">
          <h1 className="text-3xl sm:text-4xl font-black text-temu-black mb-2 tracking-tight">Browse All Categories</h1>
          <p className="text-temu-gray-text text-sm">Explore every Laclarc department and find exactly what you&apos;re looking for</p>
          {totalProducts !== null && (
            <p className="text-temu-dark text-xs font-bold mt-2">
              {fmt(totalCategories)} departments · {fmt(totalProducts)} products in stock
            </p>
          )}
        </div>

        <div className="space-y-8">
          {hub.nodes.map((node) => (
            <RootSection key={node.id || node.slug} node={node} />
          ))}
        </div>
      </div>

      {/* JSON-LD — client component (M#60) · props صغار: 14 جذر برك */}
      <CategoriesJsonLd
        items={hub.nodes.map((n) => ({ name: n.name, href: `/category/${n.slugPath}` }))}
      />
    </main>
  );
}
