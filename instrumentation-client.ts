// ──── [LACLARC::SENTRY-CLIENT-CFG] v1 (Task 16) ────
// عيون المتصفح — DSN خاصو يكون بـ NEXT_PUBLIC_ باش يوصل للكلاينت
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: 'laclarc-web@' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
  tracesSampleRate: 0,
});
// ──── [/LACLARC::SENTRY-CLIENT-CFG] ────
