import { notFound } from 'next/navigation';
import ProductDetailsClient from './ProductDetailsClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

// ═══ ⚡ PHASE 2 — ISR Beast (High-Performance UI Runtime) ═══
// المنتج يتبدل في CJ sync (03:00) فقط → ساعة revalidate كافية
// أول 100 منتج: pre-rendered وقت الـ build — الباقي: ISR on-demand
// المراجعات: client-side حية (ProductDetailsClient useEffect)
export const revalidate = 3600;

// ═══ v2.1 (Task 15) — الفروق على v2.0 ═══
// FIX-SITEURL  — https://laclarc.com كانت مكتوبة بيدك ×7 (canonical · og:url · fallback · JSON-LD)
//                → مصدر واحد SITE_URL بنفس نمط layout.tsx (Task 13): env-driven + بلا trailing slash
// FIX-OGHTTPS  — DB فيها http:// URLs قديمة ديال CJ — WhatsApp كيرفض og:image بلا https
//                (المعاينة كتخرج خاوية) → ترقية للـ CDNs المعروفين قبل ما تمشي لأي وسم
// DOC-PRIORITY — توثيق مثبت بالبرهان الحي للتفاعل مع opengraph-image.tsx ديال الجذر + تحذير الحيد
// locale       — og:locale كان غايب من صفحات المنتوجات (shallow-merge كيبدل الـ openGraph كامل)

// ═══ v2.2 (Task 15-b) — الإضافة ═══
// FIX-OGWS     — أوصاف CJ متعددة الأسطر ('\n <p><br></p>\n'...) كانت كتوصل للوسوم كتبدا
//                بـ '\n Features:\n \n' (مثبت حي 2026-10-17: og:description ديال 78299/77003)
//                → التطبيع ديال whitespace قبل substring: 160 حرف كاملين مفيدين
//                فمعاينة الشار (WhatsApp/FB) و snippet ديال جوجل نقي بلا أسطر خاوية
//                + كيرجع وصف فقط-مسافات للـ fallback إلا كان الوصف كولشي HTML خاوي

// ✨ FIX-SITEURL — مصدر واحد للدومين (اتساق مع layout.tsx Task 13)
const SITE_URL = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com').replace(/\/+$/, '');

// ✨ FIX-OGHTTPS — mirror ديال imageOptimizer FIX-HTTP (Task 10) للـ server-side OG.
//    imageOptimizer كيدير الترقية داخل IMG builders ديال الكلاينت — هنا نفس القائمة للسيرفر.
//    Backlog (Tenet #31): استخراج lib/imageUrl.ts مشترك كيتقسم بيناتهم.
const OG_HTTPS_HOSTS = /(^|\.)cjdropshipping\.com$/i;
function httpsify(u: unknown): string {
  const s = String(u ?? '');
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'http:' && OG_HTTPS_HOSTS.test(parsed.hostname)) {
      return s.replace(/^http:\/\//i, 'https://');
    }
  } catch {
    // ماشي URL صالح — كيرجعو كما هو (نفس السلوك ديال قبل، الفيلترة كتتم فالمسار ديال الـ fallback)
  }
  return s;
}

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

  // ✨ FIX-OGWS (v2.2): تطبيع whitespace قبل substring — الأوصاف متعددة الأسطر ما كياكلوش الميزانية
  const cleanDescription = product.description?.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 160) || 'Buy premium quality products at Laclarc Store with Worldwide Shipping.';
  const primaryImage = httpsify(product.image_url || product.image || `${SITE_URL}/icon-512.png`);

  return {
    // 🩹 title.absolute — اتساق مع wrapper الفئة (تحياد template double-branding)
    title: { absolute: product.seo_title || `${product.title} | Laclarc` },
    description: product.seo_meta_description || cleanDescription,
    // ✨ canonical — 73,597 صفحة منتج بلا canonical = duplicate-content risk
    alternates: { canonical: `${SITE_URL}/products/${product.id}` },
    // ═══ DOC-PRIORITY (Task 15) — التفاعل مع opengraph-image.tsx ديال الجذر (Task 13) ═══
    // مثبت حي (2026-10-16 بـ UA ديال facebookexternalhit — بوت WhatsApp/Facebook):
    //   · صفحة منتج: og:image = صورة المنتج الحقيقية ← هاد الـ config كيربح file-convention ديال الجذر
    //   · الهوم: og:image = opengraph-image (البراند 1200×630) حيت ما كاينش config images فهاد الصفحة
    // 🚨 ما تحيدش ولا واحد من الجوج:
    //    حيدت هاد الـ images → 73,597 شير كيرجعو للصورة البراندية العامة
    //    حيدت ملف الجذر → باقي الصفحات (الهوم/الفئات/غ...) بلا صورة OG
    openGraph: {
      title: product.seo_title || `${product.title} | Laclarc`,
      description: product.seo_meta_description || cleanDescription,
      url: `${SITE_URL}/products/${product.id}`,
      siteName: 'Laclarc',
      // ✨ اتساق مع الهوم — shallow-merge كيبدل الـ openGraph كامل (DOC-INHERIT Task 13)
      locale: 'en_US',
      images: [{ url: primaryImage, width: 800, height: 800, alt: product.title }],
      // ℹ️ P3 موثقة: 'product' كان كيسمح بـ og:price... ولكن كيتطلب meta إضافية
      //    برا الأنواع المدعومة فـ Next — WhatsApp/FB خدامين مزيان بـ website
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.seo_meta_description || cleanDescription,
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
  // ✨ FIX-OGWS (v2.2): نفس التطبيع للـ JSON-LD description
  const cleanDesc = product.description?.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 200)
    || 'Buy premium quality products at Laclarc with FREE Worldwide Shipping.';
  const gallery: string[] = Array.isArray(product.images)
    ? product.images.filter((i: unknown): i is string => typeof i === 'string' && i.length > 0)
    : [];
  const productImages = Array.from(new Set([
    httpsify(product.image_url || product.image || `${SITE_URL}/icon-512.png`),
    ...gallery.map(httpsify),
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
          url: `${SITE_URL}/products/${product.id}`,
          seller: { '@type': 'Organization', name: 'Laclarc' },
        },
      },
      ...(categorySegments.length > 0 ? [{
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          ...categorySegments.map((seg: string, i: number) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: seg.replace(/-/g, ' '),
            item: `${SITE_URL}/category/${categorySegments.slice(0, i + 1).join('/')}`,
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