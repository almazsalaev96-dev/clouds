/* Armi's offline shell.
 *
 * Everything the app is — notes, cards, canvases, conversations — already
 * lives in this browser, so the only thing between someone on a train and
 * their flashcards was the HTML and scripts that draw them. This keeps a
 * copy of those.
 *
 * Network first for the page itself, so a fresh deploy is what you get the
 * moment you are online, and the saved copy is only ever the fallback. Cache
 * first for the build's own files, which carry a hash in their name and
 * never change under it. Nothing else is touched: a model call, a key check,
 * a request to another origin all go straight through.
 */
const SHELL = "armi-shell-v1";
/* Old builds' files pile up one deploy at a time; past this many the oldest
   go, which is always a build nobody is running. */
const KEEP = 300;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const trim = async (cache) => {
  const keys = await cache.keys();
  const built = keys.filter((r) => new URL(r.url).pathname.startsWith("/_next/static/"));
  for (const r of built.slice(0, Math.max(0, built.length - KEEP))) await cache.delete(r);
};

const remember = (request, response) => {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(SHELL).then((cache) => cache.put(request, copy).then(() => trim(cache))).catch(() => {});
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          remember(req, res);
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    /* Hashed: the same name is the same bytes, forever. */
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            remember(req, res);
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/fonts/") || /\.(svg|png|woff2)$/.test(url.pathname)) {
    /* Named, not hashed: served from the copy at once, and the copy is
       refreshed behind it, so a replaced icon reaches everyone one load late
       rather than never. */
    event.respondWith(
      caches.match(req).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            remember(req, res);
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});
