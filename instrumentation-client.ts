// ──── [LACLARC::SENTRY-CLIENT-CFG] v2 (Task 20) ────
// عيون المتصفح — DSN خاصو يكون بـ NEXT_PUBLIC_ باش يوصل للكلاينت
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: 'laclarc-web@' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
  tracesSampleRate: 0,
});

// 🩹 FIX (Task 20) — Sentry v10 كيطلب هاد الـ hook باش يتتبعو التنقلات (navigations).
// بلاه: كل تنقل بين الصفحات كيضيع من مراقبة Sentry (warning فالـ build كيقول ACTION REQUIRED).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
// ──── [/LACLARC::SENTRY-CLIENT-CFG] ────
