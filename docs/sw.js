 /* ============================================================
   sw.js (FULL REPLACEMENT) — vLOCK-7 + SKIP_WAITING support
   - Cache bust via CACHE name
   - Can be forced to activate immediately
============================================================ */

const CACHE = "tap-n-score-vLOCK-7"; // change this to force refresh

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./index.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("message", (evt) => {
  if (evt.data && evt.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evt) => {
  evt.respondWith(
    caches.match(evt.request).then((hit) => hit || fetch(evt.request))
  );
});
