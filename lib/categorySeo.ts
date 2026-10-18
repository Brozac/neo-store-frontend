// lib/categorySeo.ts — الخطوة الأخيرة ديال SEO الأقسام (Task 21-e)
// كيجيب seo_title / seo_h1 / description / content / faqs من الباكند
// ويكاشفيهم فـ Data Cache ديال Vercel (ساعة) — fallback آمن: أي فشل = null
// والصفحة كتعمر تخدم بالسلوك القديم (الـ SEO عمرو ما يطيح شي صفحة)
import { cache } from 'react';

export interface CategorySeo {
  found: boolean;
  slug?: string;
  name?: string;
  level?: number;
  seo_title?: string | null;
  seo_h1?: string | null;
  seo_meta_description?: string | null;
  seo_content?: string | null;
  seo_faqs?: unknown;
  seo_content_version?: string | null;
}

export const fetchCategorySeo = cache(
  async (slugPath: string): Promise<CategorySeo | null> => {
    // سلاغ واحد فقط — الأخير فالمسار (nested paths كيدخلو هنا)
    const last = (slugPath || '').split('/').filter(Boolean).pop() || '';
    if (!last || !/^[a-z0-9-]+$/.test(last)) return null;
    try {
      // ✨ Tenet #4 — بلا hardcoded URLs
      const base =
        process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
      const res = await fetch(
        `${base}/api/categories/seo?slug=${encodeURIComponent(last)}`,
        {
          next: { revalidate: 3600 },
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok) return null;
      const data: CategorySeo = await res.json();
      return data?.found ? data : null;
    } catch {
      return null; // فشل الـ SEO ماكيطيحش الصفحة — fallback للسلوك القديم
    }
  }
);
