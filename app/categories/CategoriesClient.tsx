'use client';

// app/categories/CategoriesClient.tsx — Section 4: سلوك الطوارئ
//
// هادا هو السلوك القديم ديال /categories (client fetch) — ولا fallback
// من بعد ما ولّات الصفحة Server Component (page.tsx).
// كيتخدم غير ملي السُلّم كامل فاشل (hub API + tree API بجوج) — بحال
// إلا Render طايح وقت الـ build/revalidate. الأفضلية: الصفحة تخدم
// بحال قبل على ما تكون خاوية.
//
// الفرق الوحيد على القديم: تحيد بانر "NEO FALL" (بيانات قالب زائدة) —
// والباقي هو هو (spinner → fetch → عرض الشجرة بمسارات كاملة).
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

export default function CategoriesClient() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✨ Tenet #4 — بلا hardcoded URLs (كان hardcoded قبل — مصلح فالـ Section 4)
    const base =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'https://neo-store-backend.onrender.com';
    fetch(`${base}/api/categories`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setTree(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching categories:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite pb-24 font-sans">
      <div className="max-w-7xl mx-auto p-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer z-10 relative active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-10 mt-4">
          <h1 className="text-4xl font-extrabold text-temu-black mb-2">Browse All Categories</h1>
          <p className="text-temu-gray-light text-sm">Explore every Laclarc department and find exactly what you&apos;re looking for</p>
        </div>

        <div className="space-y-8">
          {tree.map((mainCat) => (
            <div key={mainCat.id} className="bg-white rounded-temu-sm p-6 border border-temu-gray-border-light shadow-sm">
              <Link
                href={`/category/${mainCat.slug}`}
                className="text-2xl font-extrabold text-temu-black mb-4 inline-block hover:text-temu-orange transition cursor-pointer active:scale-95 touch-manipulation"
              >
                {mainCat.name}
              </Link>

              {mainCat.children && mainCat.children.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                  {mainCat.children.map((subCat) => (
                    <div key={subCat.id} className="flex flex-col">
                      <Link
                        href={`/category/${mainCat.slug}/${subCat.slug}`}
                        className="text-sm font-bold text-temu-dark hover:text-temu-orange transition cursor-pointer mb-2 active:scale-95 touch-manipulation w-fit"
                      >
                        {subCat.name}
                      </Link>

                      {subCat.children && subCat.children.length > 0 && (
                        <div className="space-y-1">
                          {subCat.children.slice(0, 5).map((leaf) => (
                            <Link
                              key={leaf.id}
                              href={`/category/${mainCat.slug}/${subCat.slug}/${leaf.slug}`}
                              className="text-xs text-temu-gray-light hover:text-temu-black transition cursor-pointer block active:scale-95 touch-manipulation w-fit"
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
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
