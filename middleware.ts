// 🩹 SECURITY-FIX (audit 2026-11-18 F-H2): middleware حارس /admin — كان التعليق في
//   layout.tsx يقول "الفروع المخفية كيصدهم الـ middleware" لكن الملف ما كانش موجود أصلاً
//   (fail-open موثق). توّا:
//
//   · كل /admin/* ما عدا /admin/login يتطلب كوكي admin_hint=1 على نطاق الفرونت.
//   · admin_hint مجرد علامة UI (غير حساسة — ما يعطيش أي صلاحية): الخادم هو الحارس
//     الحقيقي (admin_token httpOnly على نطاق الـ API + ADMIN SURFACE ENFORCER).
//   · يمنع بنسف SSR/HTML cache leaking لصفحات الأدمن على بوتات/zوّار بلا جلسة،
//     ويخفي بنية endpoints الأدمن عن العموم (كانت مفسوحة في بندل الـ JS).
//
//   الدورة الكاملة:
//     login ناجح  → app/admin/login/page.tsx يضبط admin_hint=1
//     logout      → app/admin/_shell/AdminShell.tsx يمسح الكوكي
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const isLoginPage = pathname === '/admin/login';
    const hasHint = req.cookies.get('admin_hint')?.value === '1';

    if (!isLoginPage && !hasHint) {
      const url = new URL('/admin/login', req.url);
      // نحافظ على الوجهة الأصلية للعودة بعد الدخول
      if (pathname !== '/admin') url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
