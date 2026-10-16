import { notFound } from 'next/navigation';
import ProductDetailsClient from './ProductDetailsClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

// ═══ ⚡ PHASE 2 — ISR Beast (High-Performance UI Runtime) ═══
// المنتج يتبدل في CJ sync (03:00) فقط → ساعة revalidate كافية
// أول 100 منتج: pre-rendered وقت الـ build — الباقي: ISR on-demand
// المراجعات: client-side حية (ProductDetailsClient useEffect)
export const revalidate = 3600;

// ⚡ pre-generate أول 100 منتج وقت الـ build — الباقي on-demand
// ℹ️ الترتيب من السيرفر (غير موثق كـ "أحدث") — تحسين مستقبلي: ?minimal=1 (chunk خفيف ids فقط)
export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/products?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.warn('generateStaticParams: HTTP', res.status, '— ISR on-demand covers the rest');
      return [];
    }
    const products = await res.json();
    return (Array.isArray(products) ? products : [])
      .slice(0, 100)
      .map((p: { id: number | string }) => ({ id: String(p.id) }));
  } catch (e) {
    console.warn('generateStaticParams: backend unreachable — ISR on-demand covers the rest', e);
    return []; // build ما يطيحش أبداً لو backend نائم — ISR on-demand يمسك الباقي
  }
}

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      next: { revalidate: 3600, tags: [`product-${id}`] },
    });
    if (!res.ok) {
      console.warn(`getProduct(${id}): HTTP`, res.status); // 🛡️ بلا صمت — الفلسفة
      return null;
    }
    return res.json();
  } catch (e) {
    console.warn(`getProduct(${id}): fetch failed`, e);
    return null;
  }
}

async function getRelatedProducts(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${id}/related`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.warn(`getRelatedProducts(${id}): HTTP`, res.status);
      return [];
    }
    return res.json();
  } catch (e) {
    console.warn(`getRelatedProducts(${id}): fetch failed`, e);
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
    // 🩹 title.absolute — اتساق مع wrapper الفئة (تحياد template double-branding)
    title: { absolute: `${product.title} | Laclarc` },
    description: cleanDescription,
    // ✨ canonical — 73,597 صفحة منتج بلا canonical = duplicate-content risk
    alternates: { canonical: `https://laclarc.com/products/${product.id}` },
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

  // ✨ Schema.org JSON-LD — @graph: Product + BreadcrumbList (SEO / Google)
  // 🩹 TRUST (M#45 × Google spam policy): aggregateRating المزيف (4.9/38) محذوف كلياً —
  //    كان كيتطعم لجوجل مباشرة بينما الواجهة الصادقة كتقول "be the first to review"
  //    (نفس عائلة "Inject Verified Review" المطهورة + تنضيف 237,627 مراجعة وهمية).
  //    جوجل كيعاقب review markup بلا مراجعات معروضة — manual action محتمل على الموقع كامل.
  //    الترقية الحقيقية (Backlog): aggregate من /api/reviews server-side — يتضمن فقط
  //    إلا كانت مراجعات حقيقية معروضة فنفس الـ ISR render.
  const cleanDesc = product.description?.replace(/<[^>]*>?/gm, '').substring(0, 200)
    || 'Buy premium quality products at Laclarc with FREE Worldwide Shipping.';
  const gallery: string[] = Array.isArray(product.images)
    ? product.images.filter((i: unknown): i is string => typeof i === 'string' && i.length > 0)
    : [];
  const productImages = Array.from(new Set([
    product.image_url || product.image || 'https://laclarc.com/icon-512.png',
    ...gallery,
  ])) as string[];
  // 🩹 Tenet #38-aware: product.category = مسار كامل (l1/l2/l3) —Breadcrumb متدرج عليه
  const categorySegments = String(product.category || '').split('/').filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.title,
        image: productImages,
        description: cleanDesc,
        sku: `LACLARC-${product.id}`,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: product.price,
          availability: product.stock_status !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://laclarc.com/products/${product.id}`,
          seller: { '@type': 'Organization', name: 'Laclarc' },
        },
      },
      ...(categorySegments.length > 0 ? [{
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://laclarc.com/' },
          ...categorySegments.map((seg: string, i: number) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: seg.replace(/-/g, ' '),
            item: `https://laclarc.com/category/${categorySegments.slice(0, i + 1).join('/')}`,
          })),
          // الصفحة الحالية — بلا item (Google pattern للصفحة النهائية)
          { '@type': 'ListItem', position: categorySegments.length + 2, name: product.title },
        ],
      }] : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // 🛡️ escape < — عنوان منتج فيه </script> ما يقدرش يكسر ولا يحقن
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ProductDetailsClient
        product={product}
        initialReviews={initialReviews}
        relatedProducts={relatedProducts}
      />
    </>
  );
}