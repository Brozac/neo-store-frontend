'use client';

// ──── [LACLARC::SENTRY-ROUTE-ERROR] v1 (F#94) ────
// error boundary ديال segments — اللقطة الناقصة (F#94):
//   global-error.tsx كيخدم غير لأخطاء الـ root layout. أخطاء الصفحات/الكونپونونتات
//   كيصيطرهم Next بحدوده الافتراضية (default error boundary) → ما كيوصلوش لـ Sentry
//   (catch داخلي، ماشي window.onerror). هادا error.tsx كيلقطهم ويصيفطهم —
//   نفس UI الدارجة ديال global-error، بلا <html><body> حيت كيرندر داخل الـ layout.
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function RouteError({
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
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '3rem 2rem',
        textAlign: 'center',
        minHeight: '50vh',
      }}
    >
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>وقع خطأ غير متوقع</h1>
      <p style={{ color: '#666', marginBottom: '1.25rem' }}>
        عفواً، شي حاجة خسرات من عندنا. عاود المحاولة عافاك.
      </p>
      {error?.digest ? (
        <p style={{ color: '#999', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          رمز الخطأ: {error.digest}
        </p>
      ) : null}
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
    </div>
  );
}
// ──── [/LACLARC::SENTRY-ROUTE-ERROR] ────
