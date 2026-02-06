/* ============================================================
   tap-n-score/docs/sw.js (FULL REPLACEMENT) — LANDING LOCK SW
   Purpose:
   - Prevent PWA/Safari from "resuming" into SEC/target.
   - Force all NAVIGATIONS to /tap-n-score/index.html
   - Clear old caches so updates apply immediately.
============================================================ */

const VERSION = "SW-LAND-LOCK-0206A";
const LANDING_URL = "/tap-n-score/index.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // wipe any old caches (stops stale routes)
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Force ALL navigations to landing page
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      // If they try to open anything directly, we still land on index
      // (SEC/target deep-links are not allowed as an "entry page")
      return Response.redirect(LANDING_URL + "?fresh=" + Date.now(), 302);
    })());
    return;
  }

  // For assets, just pass-through (no caching)
  event.respondWith(fetch(req));
});
