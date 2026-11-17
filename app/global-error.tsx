'use client';

// ──── [LACLARC::SENTRY-GLOBAL-ERROR] v1 (Task 16) ────
// Major React errors are caught here (global-error replaces the root layout on error —
// that's why it needs <html><body>). English UI — matching the site's tone.
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
    <html lang="en" dir="ltr">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100vh',
          margin: 0,
          backgroundColor: '#F4F7FA',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="/error-bag.png"
          alt="Laclarc Error"
          style={{
            width: '240px',
            height: 'auto',
            marginBottom: '1.5rem',
            mixBlendMode: 'multiply',
          }}
        />
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#2E4057' }}>
          An unexpected error occurred
        </h1>
        <p style={{ color: '#46648A', marginBottom: '1.25rem' }}>
          Sorry, something went wrong on our end. Please try again.
        </p>
        {error?.digest ? (
          <p style={{ color: '#5B7EA6', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Error code: {error.digest}
          </p>
        ) : null}
        <button
          onClick={() => reset()}
          style={{
            padding: '0.65rem 1.75rem',
            background: '#5B7EA6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
// ──── [/LACLARC::SENTRY-GLOBAL-ERROR] ────
