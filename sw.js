const VERSION = "jerseygo-v1.1.0";
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
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (![CORE_CACHE, RUNTIME_CACHE].includes(k) ? caches.delete(k) : undefined)));
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
    return (await cache.match(req)) || null;
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

  // GOV live json: network-first
  if(url.href === "https://sojpublicdata.blob.core.windows.net/sojpublicdata/carpark-data.json"){
    event.respondWith((async ()=> (await networkFirst(req)) || fetch(req))());
    return;
  }

  // Navigation fallback
  if(isNavigationRequest(req)){
    event.respondWith((async ()=>{
      const res = await networkFirst(req);
      if(res) return res;
      const cache = await caches.open(CORE_CACHE);
      return (await cache.match("./index.html")) || new Response("Offline", { status:200, headers:{ "Content-Type":"text/plain" }});
    })());
    return;
  }

  // Same-origin assets cache-first
  if(url.origin === self.location.origin){
    event.respondWith(cacheFirst(req));
    return;
  }
});
