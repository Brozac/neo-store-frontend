'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '../../components/ProductCard';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  image: string;
  image_url?: string;
  category?: string;
  [key: string]: any;
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  
  // ✨ params.slug الآن مصفوفة تحتوي على جميع أجزاء المسار
  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/'); // دمجها لتصبح مساراً واحداً (مثال: women/clothes)
  const slug = slugArray[slugArray.length - 1]; // أخذ آخر قسم لعرضه كعنوان

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    fetch(`https://neo-store-backend.onrender.com/api/products`)
      .then((res) => res.json())
      .then((data: Product[]) => {
        // ✨ مقارنة مسار الرابط بالكامل مع قسم المنتج
        const slugLower = slugPath.toLowerCase();

        const filtered = data.filter(product => {
          const pCat = (product.category || '').toLowerCase();

          // 1. النظام الجديد (المسارات المفصولة بـ /)
          if (pCat === slugLower || pCat.startsWith(slugLower + '/')) return true;

          // 2. النظام القديم (توافق القسم الواحد الأخير للنسخ الاحتياطي)
          if (pCat === slug.toLowerCase()) return true;

          return false;
        });

        setProducts(filtered);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching products:', err);
        setLoading(false);
      });
  }, [slugPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => router.push('/categories')} className="text-temu-orange font-bold mb-6 inline-block cursor-pointer">
          ← All Categories
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-6 capitalize">{categoryName}</h1>

        {products.length === 0 ? (
          <div className="bg-white p-8 rounded-temu-sm shadow-sm text-center border border-temu-gray-border-light">
            <p className="text-temu-black font-semibold mb-2">No products found in this category yet.</p>
            <p className="text-temu-gray-light text-sm mb-6">We are adding new items daily. Check back soon!</p>
            <Link href="/" className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}