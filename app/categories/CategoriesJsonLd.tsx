'use client';

// ═══════════════════════════════════════════════════════════════════
// 🩹 SECTION 4 — CategoriesJsonLd.tsx (app/categories/CategoriesJsonLd.tsx)
//
// علاش 'use client'؟ (نفس الدرس M#60 ديال Section 3 — مهم ما تمسحوش)
// ─ الـ JSON-LD لي كيترندر من **Server Component** كيدخل جوج مرات
//   فالإخراج: مرة كـ <script> حقيقي فالـ HTML، ومرة كنص جوّا RSC
//   payload (self.__next_f.push) → Google ملي كيدير render كيعاود
//   يحيّد النسخة من الـ payload → جوج عناصر فالـ DOM.
// ─ الـ Client Component الـ payload ديالو ما فيهش النص — غير المرجع
//   والـ props. إذن: السكريبت كيخرج مرة وحدة فالـ DOM.
//
// ⚠️ هاد المكون خاصو يترندر مرة وحدة، غير من app/categories/page.tsx.
// ⚠️ الـ props ضاروريين صغار (14 جذر — name + href برك) باش الـ RSC
//    payload ما يتضخمش.
// ═══════════════════════════════════════════════════════════════════

// ✨ Tenet #4 — مصدر واحد للحقيقة (متسق مع site-jsonld.tsx و robots.ts)
const SITE_URL = (
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com'
).replace(/\/+$/, '');

export interface JsonLdItem {
  name: string;
  /** مسار داخلي: /category/{slugPath} */
  href: string;
}

export default function CategoriesJsonLd({ items }: { items: JsonLdItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Browse All Categories',
    url: `${SITE_URL}/categories`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: `${SITE_URL}${it.href}`,
      })),
    },
  };

  // 🩹 FIX-ESCAPE (نفس Task 13) — < → \u003c : إغلاق </script> مستحيل من جوّا JSON
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return (
    <script
      id="ld-json-categories"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  );
}
