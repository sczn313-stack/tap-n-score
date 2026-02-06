// TEMP SW KILL SWITCH — Tap-n-Score
// Purpose: fully unregister old SWs and stop cache hijacking

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
    })()
  );
});

// DO NOT intercept fetch at all
