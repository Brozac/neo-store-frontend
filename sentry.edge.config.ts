// ──── [LACLARC::SENTRY-EDGE-CFG] v1 (Task 16) ────
// عيون الـ edge runtime (middleware / edge routes) — كيتحمّل غير فـ NEXT_RUNTIME=edge
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: 'laclarc-web@' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
  tracesSampleRate: 0,
  // 🩹 F#94 — نفس تنقية الخصوصية ديال الباك (query_string كيقدر يحمل بيانات طلب)
  beforeSend(event) {
    if (event.request) { delete event.request.query_string; }
    return event;
  },
});
// ──── [/LACLARC::SENTRY-EDGE-CFG] ────
