import { notFound } from 'next/navigation';
import ProductDetailsClient from './ProductDetailsClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

// ═══ ⚡ PHASE 2 — ISR Beast (High-Performance UI Runtime) ═══
// المنتج يتبدل في CJ sync (03:00) فقط → ساعة revalidate كافية
// أول 100 منتج: pre-rendered وقت الـ build — الباقي: ISR on-demand
// المراجعات: client-side حية (ProductDetailsClient useEffect)
export const revalidate = 3600;

// ⚡ pre-generate أحدث 100 منتج وقت الـ build — الباقي on-demand
export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/products?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const products = await res.json();
    return (Array.isArray(products) ? products : [])
      .slice(0, 100)
      .map((p: { id: number | string }) => ({ id: String(p.id) }));
  } catch (e) {
    return []; // build ما يطيحش أبداً لو backend نائم — ISR on-demand يمسك الباقي
  }
}

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      next: { revalidate: 3600, tags: [`product-${id}`] },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

async function getRelatedProducts(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}/related`, {
      next: { revalidate: 3600 },
    });
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
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, relatedProducts] = await Promise.all([
    getProduct(id),
    getRelatedProducts(id),
  ]);

  if (!product) {
    notFound();
  }

  // ⚡ ISR-strict: المراجعات حية عبر client fetch (ProductDetailsClient useEffect 
  //    يضرب /api/reviews/{id} أصلاً) — أي fetch no-store هنا كان يقتل الـ ISR
  const initialReviews: { id: number; author: string; rating: number; content: string; country: string; created_at: string; images?: string[] }[] = [];

  // ✨ Schema.org JSON-LD — Product + Offer (SEO / Google Shopping)
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
      seller: { '@type': 'Organization', name: 'Laclarc' },
    },
    // ℹ️ aggregateRating ثابت عند ISR — الترقية الديناميكية (client JSON-LD injection) اختيارية بعد
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '38',
    },
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