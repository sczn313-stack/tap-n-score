// TAP-N-SCORE — GLOBAL POISON PILL
// Forces ALL old cached versions to die

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {

    // Delete ALL caches from any prior builds
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));

    // Take control immediately
    await self.clients.claim();

    // Reload every open page using this service worker
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of clients) {
      client.navigate(client.url);
    }

    // Remove this worker so it doesn't stick around
    await self.registration.unregister();

  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
