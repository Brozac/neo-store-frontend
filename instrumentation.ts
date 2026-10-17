// ──── [LACLARC::SENTRY-INSTRUMENTATION] v1 (Task 16) ────
// Next 15.3+ — نقطة التحميل الرسمية ديال Sentry SDK (server + edge)
// onRequestError كيلقط أخطاء الـ requests فالسيرفر (App Router)
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
// ──── [/LACLARC::SENTRY-INSTRUMENTATION] ────
