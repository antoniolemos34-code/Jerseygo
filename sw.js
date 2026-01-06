/* JerseyGo Service Worker
   - App-shell cache (offline)
   - Stale-while-revalidate for HTML
   - Cache-first for assets
*/

const VERSION = "jerseygo-v7"; // muda quando fizeres updates grandes
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./sw.js",
  "./advertise/",
  "./advertise/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("jerseygo-") && k !== VERSION)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ignore external requests (gov.je, google maps, etc.)
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.destination === "document" ||
    req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  const cache = await caches.open(VERSION);
  cache.put(req, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);

  const networkPromise = fetch(req)
    .then((fresh) => {
      cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => cached);

  return cached || networkPromise;
}
