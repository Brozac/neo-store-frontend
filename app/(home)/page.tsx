import type { Metadata } from 'next';
import HomeClient from './HomeClient';

// ═══════════════════════════════════════════════════════════════════
// 🩹 SECTION 6 — canonical للهوم (route group (home))
// المشكل: app/page.tsx كانت 'use client' → ما كتقدرش تصدّر metadata، والهوم
//         كتقرا ?search= و ?category= (SearchBar كيدفع لـ /?search=...)
//         = نسخ بلا canonical كيقدر يدخلو للفهرسة
// الحل: route group — نفس الـ URL '/'، الـ client ولّى HomeClient.tsx
//       (نفس الكود حرفياً — diff = 4 أسطر ديال import)، والـ wrapper كيصدّر
//       canonical واحد: كل الـ params كيتوحّدو فـ /
// ⚠️ التوافق: title/description/OG كيتورثو من layout كما كانوا (ما تبدل والو)
// ═══════════════════════════════════════════════════════════════════
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <HomeClient />;
}
