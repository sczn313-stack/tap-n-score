/* ============================================================
   tap-n-score/sw.js (FULL REPLACEMENT) — LANDING-FIRST NAVIGATION
   Goal:
   - Any NAVIGATION request (user typing URL, opening app, refresh)
     should resolve to the Landing page (index.html) unless explicitly
     requesting another file.
   - Network-first for HTML so you don't get stuck on old cached pages.
   - Cache static assets for speed.
============================================================ */

const VERSION = "TNS-SW-LANDING-1";
const STATIC_CACHE = `tns-static-${VERSION}`;
const HTML_CACHE = `tns-html-${VERSION}`;

// Adjust if your site is served from /tap-n-score/
const BASE = "/tap-n-score/";

// Minimal static assets you want reliably cached
const STATIC_ASSETS = [
  `${BASE}styles.css`,
  `${BASE}index.js`,
  `${BASE}sec.css`,
  `${BASE}sec.js`,
  `${BASE}download.js`,
  `${BASE}coach.js`,
  `${BASE}manifest.webmanifest`,
  `${BASE}manifest.json`,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    self.skipWaiting();

    const staticCache = await caches.open(STATIC_CACHE);
    // Best-effort caching; don't fail install if one is missing
    await Promise.allSettled(STATIC_ASSETS.map((u) => staticCache.add(u)));

    // Pre-cache landing HTML so offline fallback works
    const htmlCache = await caches.open(HTML_CACHE);
    await Promise.allSettled([
      htmlCache.add(`${BASE}index.html`),
    ]);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Kill old caches so stale routes can't “win”
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (k.startsWith("tns-") && k !== STATIC_CACHE && k !== HTML_CACHE) {
          return caches.delete(k);
        }
        return Promise.resolve();
      })
    );

    await self.clients.claim();
  })());
});

// Helpers
function isNavigation(req) {
  return req.mode === "navigate";
}

function isHtmlRequest(req) {
  const url = new URL(req.url);
  return req.headers.get("accept")?.includes("text/html") || url.pathname.endsWith(".html");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldCacheStatic(url) {
  // cache css/js/images/icons, etc.
  return (
    url.pathname.startsWith(BASE) &&
    (url.pathname.endsWith(".css") ||
     url.pathname.endsWith(".js")  ||
     url.pathname.endsWith(".png") ||
     url.pathname.endsWith(".jpg") ||
     url.pathname.endsWith(".jpeg")||
     url.pathname.endsWith(".webp")||
     url.pathname.endsWith(".svg") ||
     url.pathname.endsWith(".ico") ||
     url.pathname.endsWith(".json")||
     url.pathname.endsWith(".webmanifest"))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (!isSameOrigin(url)) return;

  // 1) NAVIGATION: Always resolve to Landing page if anything fails.
  //    Network-first so edits show up immediately.
  if (isNavigation(req) || isHtmlRequest(req)) {
    event.respondWith((async () => {
      try {
        // Try the actual requested HTML first (network)
        const fresh = await fetch(req, { cache: "no-store" });

        // If user opened a deep link explicitly (sec.html, target.html),
        // let it load; your page-level guards will redirect if needed.
        // Also: update HTML cache for offline fallback.
        const htmlCache = await caches.open(HTML_CACHE);
        htmlCache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        // Offline / SW fallback -> landing
        const htmlCache = await caches.open(HTML_CACHE);
        const cachedLanding = await htmlCache.match(`${BASE}index.html`);
        if (cachedLanding) return cachedLanding;

        // last resort
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // 2) Static assets: cache-first
  if (shouldCacheStatic(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      // best-effort cache
      cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  // 3) Everything else: passthrough
});
