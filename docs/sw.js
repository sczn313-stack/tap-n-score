const BUILD_ID = "2026-03-20-LOCKED-1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (err) {
      console.warn("SW cache clear failed:", err);
    }

    try {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of clients) {
        client.postMessage({
          type: "POISON_PILL",
          build: BUILD_ID
        });
      }
    } catch (err) {
      console.warn("SW client notify failed:", err);
    }

    try {
      await self.registration.unregister();
    } catch (err) {
      console.warn("SW unregister failed:", err);
    }

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => {
      return new Response("Offline", {
        status: 503,
        statusText: "Offline"
      });
    })
  );
});
