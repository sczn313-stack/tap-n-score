/* ============================================================
   docs/sw.js (FULL REPLACEMENT)
   Purpose:
   - STOP navigation hijack to sec.html
   - Network-first for page navigations
   - Offline fallback -> target.html
   - Clean cache versioning
============================================================ */

const VERSION = "sw-v20260202c";
const CACHE_NAME = `tap-n-score-${VERSION}`;

// Cache the bare minimum you want available offline.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./target.html",
  "./sec.html",
  "./styles.css",
  "./sec.css",
  "./index.js",
  "./sec.js",
  "./coach.js",
  "./coach.css",
  "./download.html"
];

// --- Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// --- Activate (delete old caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("tap-n-score-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests (your GitHub Pages site)
  if (url.origin !== self.location.origin) return;

  // 1) NAVIGATION: network-first, offline fallback to target.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Update cache in background
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          // Offline fallback: landing page
          const cached = await caches.match("./target.html");
          return cached || caches.match("./index.html");
        })
    );
    return;
  }

  // 2) ASSETS: cache-first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Cache successful responses
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
