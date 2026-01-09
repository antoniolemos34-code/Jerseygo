/* JerseyGo Service Worker */
const VERSION = "jerseygo-v1.0.0";
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./favicon.ico",
  "./advertise/",
  "./advertise/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== VERSION ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // cache successful same-origin requests
          try {
            const url = new URL(req.url);
            if (url.origin === self.location.origin && res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, copy));
            }
          } catch (_) {}
          return res;
        })
        .catch(() => {
          // Offline fallback: return app shell for navigation requests
          if (req.mode === "navigate") return caches.match("./index.html");
          return caches.match("./");
        });
    })
  );
});
