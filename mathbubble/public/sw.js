/**
 * Offline shell. The canvas, tools and saved pages work with no connection;
 * only asking the tutor needs the network, and those requests are never cached.
 *
 * Also the receiving end of the OS share sheet (Android/Chrome only — see
 * share_target in manifest.webmanifest): a file shared to this installed app
 * arrives here as a real POST, not a page load a normal script could handle.
 * It's stashed in its own cache and picked up by main.js on next launch.
 */

const CACHE = 'mathbubble-v2';
const SHARE_CACHE = 'mathbubble-share';
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

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target/')) {
    event.respondWith(handleShareTarget(event));
    return;
  }

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

/**
 * Reads the shared file out of the POST body and parks it in its own cache
 * (a plain Response wrapping the Blob, filename smuggled in a header — the
 * Cache API only stores Request/Response pairs, not arbitrary objects) so
 * main.js can pick it up on the page load this redirect triggers. Then a
 * 303 so the browser's follow-up request is a GET, which is all a normal
 * navigation after a form POST should ever be.
 */
async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get('file');
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        'shared-file',
        new Response(file, {
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-filename': encodeURIComponent(file.name || 'shared-file'),
          },
        })
      );
    }
  } catch {
    // No usable file — fall through to a plain redirect; the app just opens normally.
  }
  return Response.redirect('./?shared=1', 303);
}
