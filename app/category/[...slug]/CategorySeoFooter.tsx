// app/category/[...slug]/CategorySeoFooter.tsx — Server Component (Task 21-e)
// المحتوى الـ SEOي + FAQs مع JSON-LD (FAQPage) — كيتصاوب فالسيرفر (SSR كامل)
// 🔒 XSS-safe: الـ content كيتعرض كنص منقّى (نفس فلسفة sanitizeDescription Task 20)
//    — صفر HTML خام. JSON-LD كيهرب </script> عبر \u003c (الدرس المسجل فالعمل).

const sanitizeContent = (html?: string | null): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

type Faq = { q: string; a: string };

function parseFaqs(raw: unknown): Faq[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((f): Faq | null => {
      const o = (f || {}) as Record<string, unknown>;
      const q = String(o.q ?? o.question ?? '').trim();
      const a = String(o.a ?? o.answer ?? '').trim();
      return q && a ? { q, a } : null;
    })
    .filter((f): f is Faq => f !== null);
}

export default function CategorySeoFooter({
  content,
  faqs,
}: {
  content?: string | null;
  faqs?: unknown;
}) {
  const text = sanitizeContent(content);
  const items = parseFaqs(faqs);
  if (!text && items.length === 0) return null;

  // JSON-LD FAQPage — </script> breakout محصن بـ \u003c
  let jsonLd: string | null = null;
  if (items.length > 0) {
    jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    }).replace(/</g, '\\u003c');
  }

  return (
    <section className="max-w-7xl mx-auto px-6 pb-16 font-sans">
      {text && (
        <div className="bg-white p-6 rounded-temu-sm shadow-sm border border-temu-gray-border-light mt-2">
          <h2 className="text-lg font-extrabold text-temu-black mb-3">About This Collection</h2>
          <div className="text-sm text-temu-gray-text leading-relaxed whitespace-pre-line">
            {text}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="bg-white p-6 rounded-temu-sm shadow-sm border border-temu-gray-border-light mt-4">
          <h2 className="text-lg font-extrabold text-temu-black mb-3">Frequently Asked Questions</h2>
          <div className="divide-y divide-temu-gray-border-light">
            {items.map((f, i) => (
              <details key={i} className="py-3 group">
                <summary className="cursor-pointer font-bold text-sm text-temu-black list-none flex justify-between items-center gap-3">
                  {f.q}
                  <span className="text-temu-orange font-extrabold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-temu-gray-text leading-relaxed mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
    </section>
  );
}
