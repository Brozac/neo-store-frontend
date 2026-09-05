import { notFound } from 'next/navigation';
import ProductDetailsClient from './ProductDetailsClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

async function getRelatedProducts(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}/related`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  
  if (!product) return { title: 'Product Not Found | Laclarc' };

  const cleanDescription = product.description?.replace(/<[^>]*>?/gm, '').substring(0, 160) || 'Buy premium quality products at Laclarc Store with Worldwide Shipping.';
  const primaryImage = product.image_url || product.image || 'https://laclarc.com/icon-512.png';
  
  return {
    title: `${product.title} | Laclarc`,
    description: cleanDescription,
    openGraph: {
      title: `${product.title} | Laclarc`,
      description: cleanDescription,
      url: `https://laclarc.com/products/${product.id}`,
      siteName: 'Laclarc',
      images: [{ url: primaryImage, width: 800, height: 800, alt: product.title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: cleanDescription,
      images: [primaryImage],
    }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [product, relatedProducts] = await Promise.all([
    getProduct(id),
    getRelatedProducts(id)
  ]);

  if (!product) {
    notFound();
  }

  let initialReviews = [];
  try {
    const reviewsRes = await fetch(`${API_URL}/api/reviews/${id}`, { cache: 'no-store' });
    if (reviewsRes.ok) initialReviews = await reviewsRes.json();
  } catch (e) {}

  // ✨ إعداد بيانات Schema.org (JSON-LD) لتصدر نتائج جوجل و Google Shopping
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.image_url || product.image,
    description: product.description?.replace(/<[^>]*>?/gm, '').substring(0, 200),
    sku: `LACLARC-${product.id}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: product.price,
      availability: product.stock_status !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `https://laclarc.com/products/${product.id}`,
      seller: {
        '@type': 'Organization',
        name: 'Laclarc'
      }
    },
    aggregateRating: initialReviews.length > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: (initialReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / initialReviews.length).toFixed(1),
      reviewCount: initialReviews.length
    } : undefined
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailsClient 
        product={product} 
        initialReviews={initialReviews} 
        relatedProducts={relatedProducts} 
      />
    </>
  );
}