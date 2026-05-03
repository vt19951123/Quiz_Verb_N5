const CACHE_NAME = 'quiz-n5-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Cài đặt Service Worker và lưu cache các file tĩnh
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Xóa cache cũ nếu có phiên bản mới
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept các request để trả về từ cache nếu offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Trả về response từ cache nếu có, ngược lại gọi fetch qua mạng
      return response || fetch(event.request);
    }).catch(() => {
      // Offline fallback (nếu cần, nhưng ở đây single page app đã được cache đủ)
    })
  );
});
