const CACHE_NAME = 'neo-store-cache-v1';
const PRECACHE_ASSETS = ['/', '/manifest.webmanifest'];

// تثبيت الـ Service Worker وحفظ الصفحة الرئيسية في الكاش
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    cache.addAll(PRECACHE_ASSETS);
  })());
});

// تفعيل الـ Service Worker والسيطرة الفورية
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// استراتيجية Cache-First: البحث في الكاش أولاً، ثم الإنترنت
self.addEventListener('fetch', event => {
  event.respondWith(async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse !== undefined) {
      return cachedResponse;
    } else {
      return fetch(event.request);
    }
  })();
});