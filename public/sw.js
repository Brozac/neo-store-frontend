// public/sw.js - Laclarc Enterprise PWA Engine (Sovereign v3.1 Final)
// ============================================================
// الاستراتيجيات:
//   • HTML Navigation      → Network-First (تحديثات فورية + Offline fallback)
//   • Static Assets        → Stale-While-Revalidate (سرعة + تحديث خلفي)
//   • صفحات الدفع          → الشبكة حصراً (لا كاش أبداً)
//   • /api/ و /admin       → مستثناة تماماً من الـ SW
// ============================================================

const CACHE_NAME = 'laclarc-pwa-v14';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

// ✨ مسارات الدفع والجلسات الحساسة — لا تُخزن في الكاش أبداً
// (تحتوي session_id + لا معنى لعرضها في وضع Offline)
const NEVER_CACHE_ROUTES = ['/success', '/cancel', '/checkout'];

// ✨ سقف الكاش الديناميكي — مع حماية الأصول الأساسية (Precache) من الحذف
// بحيث لا يختفي الـ Offline Fallback ('/') تحت الضغط أبداً
const MAX_DYNAMIC_ENTRIES = 120;

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    // استبعاد ملفات الـ Precache الأساسية من عملية الحذف
    const dynamicRequests = requests.filter((req) => {
      const pathname = new URL(req.url).pathname;
      return !PRECACHE_ASSETS.includes(pathname);
    });

    if (dynamicRequests.length <= maxEntries) return;

    // حذف الأقدم أولاً (cache.keys() يعيد حسب ترتيب الاستخدام —
    // الصفحات النشطة تعاد للآخر عند كل تحديث فتبقى حية تلقائياً)
    for (let i = 0; i < dynamicRequests.length - maxEntries; i++) {
      await cache.delete(dynamicRequests[i]);
    }
  } catch (e) {
    // تجاوز أخطاء الكاش لعدم تعطيل الـ Service Worker إطلاقاً
  }
}

// ============================================================
// 1. التثبيت (Install) — صامد ضد فشل أي أصل فرعي
//    Promise.allSettled: فشل صورة واحدة لا يقتل التثبيت كله
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset))
      );
      // داخل waitUntil — منع قتل العملية أثناء التثبيت
      await self.skipWaiting();
    })()
  );
});

// ============================================================
// 2. التفعيل — مسح كل الكاش القديم تلقائياً
//    (بما في ذلك legacy: neo-store-cache-v1)
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('🧹 Purging outdated PWA cache:', name);
            return caches.delete(name);
          })
      ))
      .then(() => self.clients.claim()) // السيطرة الفورية على كل التبويبات المفتوحة
  );
});

// ============================================================
// 3. راوتر الجلب الذكي (Smart Fetch Router)
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استثناء الطلبات غير الـ GET أو الخارجية (الـ API ديال Render خارجية أصلاً)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // استثناء مسارات الأدمن والـ API تماماً من الكاش (Section 8.4)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // ===== الصفحات (HTML Navigation): Network-First =====
  if (request.mode === 'navigate') {
    const isSensitive = NEVER_CACHE_ROUTES.some((route) =>
      url.pathname.startsWith(route)
    );

    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // لا نخزن /success و /cancel و /checkout إطلاقاً
          if (networkResponse && networkResponse.status === 200 && !isSensitive) {
            const clone = networkResponse.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(async (cache) => {
                await cache.put(request, clone);
                await trimCache(CACHE_NAME, MAX_DYNAMIC_ENTRIES);
              })
            );
          }
          return networkResponse;
        })
        .catch(async () => {
          // وضع الـ Offline فقط:
          // 1) الصفحة المطلوبة من الكاش (ignoreSearch لدعم /?homescreen=1)
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          if (cachedPage) return cachedPage;

          // 2) الصفحة الرئيسية كـ fallback أخير
          const fallbackHome = await caches.match('/', { ignoreSearch: true });
          return fallbackHome || Response.error();
        })
    );
    return;
  }

  // ===== الأصول الثابتة (Chunks, Fonts, Images): Stale-While-Revalidate =====
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // ✨ كاين كاش: نقدمه فوراً + نحدث الخلفية بشكل مستقل ونظيف
      if (cachedResponse) {
        event.waitUntil(
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                return caches.open(CACHE_NAME).then((cache) =>
                  cache.put(request, clone)
                );
              }
            })
            .catch(() => {}) // فشل التحديث الخلفي لا يهم — الكاش يخدم
        );
        return cachedResponse;
      }

      // ✨ لا كاش: الشبكة مباشرة + تخزين للمرة القادمة
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(request, clone)
              )
            );
          }
          return networkResponse;
        })
        .catch(() => Response.error());
    })
  );
});