/* sw.js — PASS-THROUGH (NO CACHE) */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Do not cache. Always go to network.
  event.respondWith(fetch(event.request));
});
