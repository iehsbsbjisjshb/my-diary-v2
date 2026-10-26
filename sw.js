const CACHE_NAME = 'diary-v2-v10';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './storage.js',
  './sync.js',
  './toast.js',
  './ui/today.js',
  './ui/week.js',
  './ui/school.js',
  './ui/notes.js',
  './ui/settings.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

// Установка: прекэширование всех статических файлов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Активация: удаление устаревших кэшей и захват клиентов
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка сообщений (skipWaiting по команде пользователя)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Игнорируем не-GET запросы и сторонние протоколы
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. /state (Cloudflare Worker) — network-only (синк всегда свежий)
  if (url.pathname.endsWith('/state') || url.pathname.endsWith('/state/')) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Навигационные запросы (mode === "navigate") — network-first, в офлайне отдаем index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('./index.html') || await caches.match('index.html');
          return fallback;
        })
    );
    return;
  }

  // 3. Остальное — cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      });
    })
  );
});
