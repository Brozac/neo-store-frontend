'use client';

// ──── [LACLARC::SENTRY-ROUTE-ERROR] v1 (F#94) ────
// Route segment error boundary — the missing piece (F#94):
//   global-error.tsx only handles root layout errors. Page/component errors
//   are caught by Next.js's default error boundary → they never reach Sentry
//   (internal catch, not window.onerror). This error.tsx catches and reports them —
//   same UI as global-error, without <html><body> since it renders inside the layout.
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
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>An unexpected error occurred</h1>
      <p style={{ color: '#666', marginBottom: '1.25rem' }}>
        Sorry, something went wrong on our end. Please try again.
      </p>
      {error?.digest ? (
        <p style={{ color: '#999', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Error code: {error.digest}
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
        Try again
      </button>
    </div>
  );
}
// ──── [/LACLARC::SENTRY-ROUTE-ERROR] ────
