'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

export default function CategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://neo-store-backend.onrender.com/api/categories')
      .then(res => res.json())
      .then(data => {
        setTree(data);
        setLoading(false);
      })
      .catch(err => {
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
        
        <Link href="/" className="text-temu-orange font-bold mb-6 inline-block cursor-pointer z-10 relative">
          ← Back to Home
        </Link>

        <div className="text-center mb-10 mt-4">
          <h1 className="text-4xl font-extrabold text-temu-black mb-2">Explore Categories</h1>
          <p className="text-temu-gray-light text-sm">Find exactly what you're looking for</p>
        </div>

        {/* بانر ترويجي */}
        <div className="relative bg-gradient-to-br from-temu-green to-temu-purple rounded-3xl p-8 mb-12 overflow-hidden shadow-lg">
          <div className="relative z-10">
            <p className="text-temu-yellow text-xs font-bold uppercase tracking-widest mb-1">New Collection</p>
            <h2 className="text-white text-3xl font-extrabold leading-tight mb-4">NEO FALL<br/>STAY FASHION</h2>
            <Link href="/" className="bg-white text-temu-black text-xs font-extrabold py-3 px-6 rounded-full hover:bg-temu-offwhite transition shadow-md cursor-pointer inline-block">
              Shop Now
            </Link>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full"></div>
          <div className="absolute right-12 top-4 w-24 h-24 bg-white/10 rounded-full"></div>
        </div>

        {/* عرض الشجرة الديناميكي */}
        <div className="space-y-8">
          {tree.map((mainCat) => (
            <div key={mainCat.id} className="bg-white rounded-temu-sm p-6 border border-temu-gray-border-light">
              {/* عنوان القسم الرئيسي */}
              <Link 
                href={`/category/${mainCat.slug}`}
                className="text-2xl font-extrabold text-temu-black mb-4 inline-block hover:text-temu-orange transition cursor-pointer"
              >
                {mainCat.name}
              </Link>

              {/* عرض الفروع (المستوى الثاني) */}
              {mainCat.children && mainCat.children.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                  {mainCat.children.map((subCat) => (
                    <div key={subCat.id} className="flex flex-col">
                      <Link 
                        href={`/category/${mainCat.slug}/${subCat.slug}`}
                        className="text-sm font-bold text-temu-dark hover:text-temu-orange transition cursor-pointer mb-2"
                      >
                        {subCat.name}
                      </Link>

                      {/* عرض الفروع التحتية (المستوى الثالث) */}
                      {subCat.children && subCat.children.length > 0 && (
                        <div className="space-y-1">
                          {subCat.children.slice(0, 5).map((leaf) => ( // نعرض أول 5 فروع لتفادي الازدحام
                            <Link 
                              key={leaf.id} 
                              href={`/category/${mainCat.slug}/${subCat.slug}/${leaf.slug}`}
                              className="text-xs text-temu-gray-light hover:text-temu-black transition cursor-pointer block"
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