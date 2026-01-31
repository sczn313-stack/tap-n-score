/* ============================================================
   sw.js (FULL REPLACEMENT) — CACHE-BUST-FIX-1
   Goals:
   - NEVER get stuck on old JS/CSS again
   - Always fetch fresh index.js / styles.css / index.html
   - Still allow offline fallback for static assets
============================================================ */

const CACHE_VERSION = "tap-n-score-v" + Date.now(); // unique every deploy
const STATIC_CACHE = CACHE_VERSION;

// These can be cached (icons, manifest). We DO NOT pin index.js/styles.css/html.
const STATIC_ASSETS = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === STATIC_CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

// Helper: decide if this request must ALWAYS be fresh
function isAlwaysFresh(url) {
  // Force fresh HTML/CSS/JS so updates show instantly
  return (
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/index.js")
  );
}

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests (your site files)
  if (url.origin !== self.location.origin) return;

  // 1) ALWAYS FRESH: network-first with cache fallback (rare offline)
  if (isAlwaysFresh(url)) {
    evt.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) Static assets: cache-first (icons/manifest), then network
  evt.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Only cache successful basic responses
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
