// FitGuide Web — Service Worker (офлайн-работа PWA)
//
// ВАЖНО: все пути относительные. Приложение может лежать в подпапке
// (https://user.github.io/repo/) — абсолютный '/index.html' даёт 404,
// cache.addAll падает целиком, SW не устанавливается, и браузер
// не считает приложение устанавливаемым (ярлык открывается во вкладке).

const CACHE_NAME = 'fitguide-v1.14';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './knowledge.md',
  './exercises.json',
  './picker.json',
];

// Установка — кэшируем статику. Каждый файл отдельно: одна ошибка
// не должна обрушить всю установку.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[sw] ne zKeshiрован', url, err))
        )
      );
      // ВАЖНО: skipWaiting() НЕ await-им. Он резолвится, когда новый воркер
      // вступит в силу, а это происходит только ПОСЛЕ установки. Если ждать
      // его внутри install — дедлок: install не кончится, пока skipWaiting не
      // разблокируется, а он не разблокируется, пока install не кончится.
      // Воркер навсегда остаётся в состоянии installing, а браузер не считает
      // приложение устанавливаемым.
      self.skipWaiting();
    })
  );
});

// Активация — чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  // claim тоже не ждём — по той же причине, что и skipWaiting
  self.clients.claim();
});

// Fetch — Stale While Revalidate: отдаём кэш сразу, обновляем в фоне.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигация (index.html) — сначала сеть: после обновления приложения телефон
  // не должен застревать на старой версии с другим viewport/разметкой.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(request);
          return cached || cache.match('./index.html') || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
