// app/sitemap.ts - Laclarc Automated Dynamic Sitemap
import type { MetadataRoute } from 'next';

// ✨ سلسلة fallbacks: متغير مخصص → متغير Vercel الأوتوماتيكي → الدومين الرسمي
const SITE_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://laclarc.com');

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://neo-store-backend.onrender.com';

// ✨ شجرة الأقسام: مشي عمقي (Level 1 + كل الـ children) — ماشي غير المستوى الأول
interface CategoryNode {
  slug?: string;
  children?: CategoryNode[];
}

function flattenCategoryTree(nodes: CategoryNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node?.slug) out.push(node.slug);
    if (Array.isArray(node?.children) && node.children.length > 0) {
      flattenCategoryTree(node.children, out);
    }
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. الصفحات الأساسية والقانونية
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/all-products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/track-order`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
  ];

  // 2. الأقسام الديناميكية (شجرة كاملة — كل المستويات)
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const catRes = await fetch(`${BACKEND_URL}/api/categories`, {
      next: { revalidate: 86400 }, // تحديث يومي
    });
    if (catRes.ok) {
      const data = await catRes.json();
      // ✨ دفاعي: الرد ممكن يكون Array مباشرة ولا Object فيه children
      const tree: CategoryNode[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.children)
          ? data.children
          : [];
      const slugs = flattenCategoryTree(tree);
      categoryPages = slugs.map((slug) => ({
        url: `${SITE_URL}/category/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch {
    console.warn('Sitemap: Category fetch fallback');
  }

  // 3. المنتجات (غير المتوفرة stock_status=true كيرجعها الـ backend أصلاً)
let productPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/products?minimal=1`, {
      next: { revalidate: 3600 }, // تحديث كل ساعة
    });
    if (!res.ok) throw new Error(`products HTTP ${res.status}`);
    const products = await res.json();
    if (!Array.isArray(products) || products.length === 0) {
      // 🛡️ fail-closed — feed فارغ/منحرف = لا مسح صامت لروابط المنتجات
      throw new Error('sitemap: empty product feed');
    }
    productPages = products.map((product: any) => ({
      url: `${SITE_URL}/products/${product.id}`,
      lastModified: product.created_at ? new Date(product.created_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    }));
  } catch (error) {
    console.error('Sitemap: Product fetch fallback', error);
  }
  if (productPages.length === 0) {
    // ⛔ فشل صريح — Google تحتفظ بآخر sitemap صالح بدل قائمة مقطوعة
    throw new Error('sitemap: no product URLs — aborting to keep last valid sitemap');
  }

  // ✨ منع التكرار (URL وحد مرة وحدة) — حماية رخيصة ومهمة
  const seen = new Set<string>();
  const all = [...staticPages, ...categoryPages, ...productPages].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  return all;
}