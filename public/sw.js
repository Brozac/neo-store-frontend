// public/sw.js - Laclarc Enterprise PWA Engine
const CACHE_NAME = 'laclarc-pwa-v2'; // ✨ اسم ورقم إصدار جديد يمسح كل شيء قديم
const PRECACHE_ASSETS = [
  '/', 
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/placeholder.jpg'
];

// 1. التثبيت والتحميل المسبق (Install)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // ✨ تفعيل فوري دون انتظار إغلاق المتصفح
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// 2. التفعيل ومسح الكاش القديم تلقائياً (Activate & Clean Old Caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // ✨ حذف أي كاش قديم بما في ذلك neo-store-cache-v1 فوراً
          if (cache !== CACHE_NAME) {
            console.log('🧹 Purging outdated PWA cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // السيطرة الفورية على كل التبويبات المفتوحة
  );
});

// 3. استراتيجية الجلب الذكية (Network-First for Pages, Cache Fallback for Offline)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استثناء الطلبات غير المتعلقة بالـ GET أو الخارجية
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // استثناء مسارات الأدمن والـ API تماماً من الكاش
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // ✨ للصفحات وعمليات التنقل (HTML Documents): نطلب دائماً من الإنترنت أولاً لتظهر التحديثات فوراً
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // حفظ أحدث نسخة في الكاش للمستقبل
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // إذا كان الزبون في وضع الـ Offline فقط، نرجع الصفحة المحفوظة
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const fallbackHome = await caches.match('/');
          return fallbackHome || Response.error();
        })
    );
    return;
  }

  // للملفات الثابتة (الصور، الأيقونات): Cache First مع تحديث الخلفية
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});