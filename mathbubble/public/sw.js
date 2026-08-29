/**
 * Offline shell. The canvas, tools and saved pages work with no connection;
 * only asking the tutor needs the network, and those requests are never cached.
 */

const CACHE = 'mathbubble-v1';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/main.js',
  './js/board.js',
  './js/bubble.js',
  './js/shade.js',
  './js/chat.js',
  './js/api.js',
  './js/store.js',
  './js/render.js',
  './vendor/katex/katex.min.js',
  './vendor/katex/katex.min.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache tutor traffic, wherever the app is mounted.
  if (event.request.method !== 'GET' || url.pathname.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((hit) => {
      const live = fetch(event.request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      // Cached shell first for instant launch, refreshed in the background.
      return hit || live;
    })
  );
});
