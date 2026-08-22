const CACHE_NAME = 'neo-store-cache-v1';
const PRECACHE_ASSETS = ['/', '/manifest.webmanifest'];

// تثبيت الـ Service Worker وحفظ الصفحة الرئيسية في الكاش
self.addEventListener('install', event => {
  // ✨ تفعيل الـ SW الجديد فوراً بلا ما ينتظر إغلاق كل التبويبات المفتوحة —
  // ضروري باش هاد التصحيح يطبق مباشرة عند أول نشر (deploy) بلا ما نضطرو
  // نمسحو الـ SW القديم يدوياً من كل جهاز مستخدم.
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_ASSETS);
  })());
});

// تفعيل الـ Service Worker والسيطرة الفورية
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// استراتيجية Cache-First: البحث في الكاش أولاً، ثم الإنترنت
self.addEventListener('fetch', event => {
  const { request } = event;

  // ✨ التصحيح الأساسي: لا نتدخل خالص فـ:
  //   1) الطلبات لي ماشي GET (POST/PUT/DELETE) — بحال كل طلبات الأدمن
  //      (add-product, sync-categories, add-coupon...)
  //   2) الطلبات لدومين آخر غير دومين الموقع نفسه (الباكاند على onrender.com،
  //      بيكسلات فيسبوك/تيكتوك، إلخ)
  // Cache API ماشي مصمم للتعامل مع هاد النوع ديال الطلبات، وأي محاولة
  // تدخل فيهم (حتى قراءة فقط عبر cache.match) كتقدر ترمي استثناء غير
  // محمي بـ try/catch ويخلي الصفحة تشوف "Network Error" رغم أن الطلب
  // الحقيقي للسيرفر نجح.
  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || !isSameOrigin) {
    return; // ما كايناش respondWith هنا = الطلب كيمشي مباشرة للشبكة، بلا تدخل SW
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse; // إرجاع النسخة المحفوظة إذا وجدت
    }

    try {
      // إذا لم توجد في الكاش، جلبها من الإنترنت
      const networkResponse = await fetch(request);
      return networkResponse;
    } catch (error) {
      // إذا فشل الإنترنت ولم تكن الصفحة محفوظة، نرجع للصفحة الرئيسية
      const fallback = await caches.match('/');
      // ✨ حماية إضافية: respondWith ما كايقبلش undefined كـ Response،
      // فإلا حتى الصفحة الرئيسية ماكانتش فالكاش، نرجعو Response.error()
      // بدل ما نخليو الاستثناء يهرب بلا رد.
      return fallback || Response.error();
    }
  })());
});