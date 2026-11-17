'use client';

// ──── [LACLARC::SENTRY-ROUTE-ERROR] v1 (F#94) ────
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
          width: '160px',
          height: 'auto',
          marginBottom: '1.25rem',
        }}
      />
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#2E4057' }}>
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
          padding: '0.55rem 1.4rem',
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
    </div>
  );
}
// ──── [/LACLARC::SENTRY-ROUTE-ERROR] ────
