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

  // 🩹 Phase I incident (2026-11-23): الـ zone cache خزّن ردود admin GET المعتمدة
  //   (بلا Cache-Control) وخدمها لأي زائر بلا كوكي (cf-cache-status: HIT بمعطيات
  //   طلبات حقيقية!) — درس H.5 على مستوى API كامل: no-store صريح على كل /api/*
  //   ماعدا الكاطلوج المتكاشي عمداً (categories · products list/[id]/related —
  //   الملفات ديالهم عندها withEdgeCache + s-maxage ديالهم).
  if (pathname.startsWith('/api/')) {
    const cacheable =
      pathname === '/api/categories' ||
      pathname === '/api/products' ||
      pathname.startsWith('/api/products/');
    if (!cacheable) {
      const res = NextResponse.next();
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  }

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
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
};
