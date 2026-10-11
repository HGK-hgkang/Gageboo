const CACHE_NAME = "gageboo-v5";

const CORE_LOCAL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png"
];

const EXTERNAL_ASSETS = [
  "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-is/18.2.0/umd/react-is.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js",
  "https://unpkg.com/recharts@2.8.0/umd/Recharts.js"
];

// Service Worker Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Cache critical local assets
      for (const url of CORE_LOCAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] Local asset cache warning:", url, err);
        }
      }
      // 2. Cache external CDN assets (fail-safe)
      for (const url of EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] External asset cache warning:", url, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Service Worker Fetch
self.addEventListener("fetch", event => {
  const req = event.request;

  // Let non-GET and Firebase Firestore/Auth requests pass directly to network
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("firebasestorage.app")
  ) {
    return;
  }

  // HTML Navigation: Network first, fall back to cache
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("/index.html") || caches.match(req))
    );
    return;
  }

  // Other static assets: Cache first, fall back to network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
