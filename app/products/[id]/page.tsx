import { notFound } from 'next/navigation';
import ProductDetailsClient from './ProductDetailsClient';

// ✨ استخدام متغير البيئة بدلاً من الرابط المباشر
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ✨ جلب المنتج من السيرفر مباشرة
async function getProduct(id: string) {
  const res = await fetch(`${API_URL}/api/products/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

// ✨ جلب 4 منتجات مشابهة فقط من السيرفر (يحل مشكلة الأداء)
async function getRelatedProducts(id: string) {
  const res = await fetch(`${API_URL}/api/products/${id}/related`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

// ✨ إنشاء Metadata ديناميكية لـ SEO (جوجل سيقرأها)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  
  if (!product) return { title: 'Product Not Found | Laclarc' };
  
  return {
    title: `${product.title} | Laclarc`,
    description: product.description?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Buy high quality products at Laclarc',
    openGraph: {
      title: product.title,
      description: product.description?.replace(/<[^>]*>?/gm, '').substring(0, 150),
      images: [product.image || product.image_url],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // جلب المنتج والمنتجات المشابهة بالتوازي
  const [product, relatedProducts] = await Promise.all([
    getProduct(id),
    getRelatedProducts(id)
  ]);

  if (!product) {
    notFound();
  }

  // جلب التقييمات الأولية
  const reviewsRes = await fetch(`${API_URL}/api/reviews/${id}`);
  const initialReviews = reviewsRes.ok ? await reviewsRes.json() : [];

  return (
    <ProductDetailsClient 
      product={product} 
      initialReviews={initialReviews} 
      relatedProducts={relatedProducts} 
    />
  );
}