'use client';

// ═══════════════════════════════════════════════════════════════════
// 🩹 SECTION 3 HOTFIX — site-jsonld.tsx (components/site-jsonld.tsx)
//
// علاش 'use client'؟ (السبب التقني — مهم ما تمسحوش)
// ─ Google Rich Results Test كان كيشوف OnlineStore مرتين متطابقين.
// ─ السبب (موثّق فـ vercel/next.js discussion #66896): الـ JSON-LD لي
//   كيترندر من **Server Component** (كيما كان فـ layout.tsx) كيدخل
//   مرتين فالإخراج: مرة كـ <script> حقيقي فالـ HTML، ومرة كنص معاد
//   جوّا RSC payload (self.__next_f.push) — وملي Google كيدير render
//   بالجافاسكريبت، React كيعاود يحيّد النسخة من الـ payload → جوج
//   عناصر متطابقين فالـ DOM.
// ─ الـ Client Component الـ payload ديالو ما فيهش النص المعاد — غير
//   المرجع ديالو. إذن: SSR كيخرج السكريبت مرة وحدة، وما كاين ما يتضاعف.
//
// ⚠️ هاد المكون خاصو يترندر مرة وحدة فقط، فالصفحة الرئيسية (app/page.tsx).
// ⚠️ ماتستوردوش من Server Component آخر — غادي يرجع التكرار.
// ═══════════════════════════════════════════════════════════════════

// ✨ Tenet #4 — مصدر واحد للحقيقة (متسق مع sitemap.ts و robots.ts)
// 🩹 FIX-SLASH — بلا trailing slash (نفس منطق layout القديم)
const SITE_URL = (
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://laclarc.com'
).replace(/\/+$/, '');

// نفس القيم الحقيقية لي كانو live (صفر تغيير فالمحتوى — غير المكان)
// 🔒 sameAs خاوي عمداً: ما كايناش حسابات اجتماعية رسمية موثقة — قاعدة الصدق DRS
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'OnlineStore',
      name: 'Laclarc',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      description:
        'Curated lifestyle gear, electric grooming innovations, and daily essentials with free worldwide delivery.',
    },
    {
      '@type': 'WebSite',
      name: 'Laclarc',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          // ✓ truth-gate: https://laclarc.com/?search=watch → 200
          //   SearchBar.tsx كيدير push لـ /?search= و page.tsx كيقرا searchParams
          urlTemplate: `${SITE_URL}/?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

// 🩹 FIX-ESCAPE (Task 13) — < → \u003c : إغلاق </script> مستحيل من جوّا الـ JSON
const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

export default function SiteJsonLd() {
  return (
    <script
      id="ld-json-site"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  );
}
