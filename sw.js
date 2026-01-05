const VERSION = "jerseygo-v1.0.0";
const CORE_CACHE = `core-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (![CORE_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});

function isNavigationRequest(req){
  return req.mode === "navigate" || (req.method === "GET" && req.headers.get("accept")?.includes("text/html"));
}

async function networkFirst(req){
  const cache = await caches.open(RUNTIME_CACHE);
  try{
    const res = await fetch(req);
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  }catch{
    const cached = await cache.match(req);
    return cached || null;
  }
}

async function cacheFirst(req){
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if(cached) return cached;
  const res = await fetch(req);
  if(res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if(req.method !== "GET") return;

  if(url.href === "https://sojpublicdata.blob.core.windows.net/sojpublicdata/carpark-data.json"){
    event.respondWith((async ()=>{
      const res = await networkFirst(req);
      return res || fetch(req);
    })());
    return;
  }

  if(isNavigationRequest(req)){
    event.respondWith((async ()=>{
      const res = await networkFirst(req);
      if(res) return res;
      const cache = await caches.open(CORE_CACHE);
      const fallback = await cache.match("./index.html");
      return fallback || new Response("Offline", { status: 200, headers: { "Content-Type":"text/plain" }});
    })());
    return;
  }

  if(url.origin === self.location.origin){
    event.respondWith(cacheFirst(req));
    return;
  }
});
