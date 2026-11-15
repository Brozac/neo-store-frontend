// ──── [LACLARC::SENTRY-CLIENT-CFG] v2 (Task 20) ────
// عيون المتصفح — DSN خاصو يكون بـ NEXT_PUBLIC_ باش يوصل للكلاينت
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: 'laclarc-web@' + (process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
  tracesSampleRate: 0,
  // 🩹 F#94 — نفس تنقية الخصوصية ديال الباك: query_string كيقدر يحمل رقم الطلب/إيميل
  //   فروابط /track-order — المسار كيبقى للديباك، البراميترات ما كتمشيش
  beforeSend(event) {
    if (event.request) { delete event.request.query_string; }
    return event;
  },
});

// 🩹 FIX (Task 20) — Sentry v10 كيطلب هاد الـ hook باش يتتبعو التنقلات (navigations).
// بلاه: كل تنقل بين الصفحات كيضيع من مراقبة Sentry (warning فالـ build كيقول ACTION REQUIRED).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
// ──── [/LACLARC::SENTRY-CLIENT-CFG] ────
