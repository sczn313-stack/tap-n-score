/* ============================================================
   sw.js (FULL REPLACEMENT) — SERVICE WORKER KILL SWITCH
   Purpose:
   - Delete ALL SW caches
   - Unregister THIS service worker
   - Force clients to reload
   ============================================================ */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      // delete all caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}

    try {
      // unregister THIS SW
      await self.registration.unregister();
    } catch {}

    try {
      // reload any open clients so they come back "clean"
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        try { c.navigate(c.url); } catch {}
      }
    } catch {}
  })());
});

// Always pass-through network (no caching)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
