const CACHE_NAME = 'diary-v2-v46';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './flatpickr.min.css',
  './flatpickr.min.js',
  './app.js',
  './storage.js',
  './sync.js',
  './toast.js',
  './ui/today.js',
  './ui/week.js',
  './ui/school.js',
  './ui/notes.js',
  './ui/settings.js',
  './ui/datepicker.js',
  './manifest.json',
  './1.svg',
  './icon-192.svg',
  './icon-512.svg'
];

const PRECACHE_ASSETS = STATIC_ASSETS;

// Установка: прекэширование всех статических файлов и немедленный переход к активации
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Активация: удаление устаревших кэшей и немедленный захват клиентов
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

  // 2. Навигация (HTML) — Fast Network с быстрым fallback на кэш (1200 мс)
  // Это гарантирует открытие PWA на любом Wi-Fi даже при медленном соединении или блокировках
  if (request.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let isDone = false;

        const fallbackToCache = async () => {
          if (isDone) return;
          const cached = (await caches.match('./index.html')) || 
                         (await caches.match('index.html')) || 
                         (await caches.match('./')) || 
                         (await caches.match('/'));
          if (cached && !isDone) {
            isDone = true;
            resolve(cached);
          }
        };

        const timer = setTimeout(fallbackToCache, 1200);

        fetch(request)
          .then((networkResponse) => {
            clearTimeout(timer);
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
              if (!isDone) {
                isDone = true;
                resolve(networkResponse);
              }
            } else {
              fallbackToCache().then(() => {
                if (!isDone) {
                  isDone = true;
                  resolve(networkResponse);
                }
              });
            }
          })
          .catch(async () => {
            clearTimeout(timer);
            await fallbackToCache();
            if (!isDone) {
              isDone = true;
              resolve(new Response('Offline', { status: 503, statusText: 'Offline' }));
            }
          });
      })
    );
    return;
  }

  // 3. Локальные статические ассеты (JS, CSS, SVG, JSON) — Stale-While-Revalidate
  // Из кэша отдаются мгновенно (0 мс), сетевой запрос обновляет кэш в фоне
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Внешние ресурсы (например, шрифты) — cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      }).catch(() => new Response('', { status: 408, statusText: 'Timeout' }));
    })
  );
});
