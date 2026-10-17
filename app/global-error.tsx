'use client';

// ──── [LACLARC::SENTRY-GLOBAL-ERROR] v1 (Task 16) ────
// أخطاء React الكبرى كتلقط هنا (global-error كيبدل الـ root layout وقت الخطأ —
// علاش خاصو <html><body>). UI بالدارجة — نفس نبرة الموقع.
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>وقع خطأ غير متوقع</h1>
        <p style={{ color: '#666', marginBottom: '1.25rem' }}>
          عفواً، شي حاجة خسرات من عندنا. عاود المحاولة عافاك.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '0.55rem 1.4rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          عاود المحاولة
        </button>
      </body>
    </html>
  );
}
// ──── [/LACLARC::SENTRY-GLOBAL-ERROR] ────
