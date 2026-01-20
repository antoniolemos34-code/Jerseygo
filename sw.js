/* JerseyGo Service Worker */
const VERSION = "jerseygo-v1.1.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./favicon.ico",
  "./icon-192.png",
  "./icon-512.png",
  "./advertise/",
  "./advertise/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    // Add shell files one by one to avoid install failing if one file is missing.
    await Promise.all(APP_SHELL.map(async (path) => {
      try { await cache.add(path); } catch (_) {}
    }));

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== VERSION ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

// Stale-while-revalidate for same-origin GET requests
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    try {
      const url = new URL(req.url);
      if (url.origin === self.location.origin && res && res.ok) {
        cache.put(req, res.clone());
      }
    } catch (_) {}
    return res;
  }).catch(() => null);

  return cached || (await fetchPromise);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin in cache strategy (avoid third-party issues)
  if (url.origin !== self.location.origin) return;

  // Navigation requests (SPA/PWA) -> serve index.html offline
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // keep index cached (optional but useful)
        const cache = await caches.open(VERSION);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(VERSION);
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Assets / files
  event.respondWith(staleWhileRevalidate(req));
});
