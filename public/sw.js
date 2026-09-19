/* EduSkill India Foundation – offline shell service worker (hand-written, no build step).
 *
 * Rules:
 *  - cache-first: /_next/static/*, /icons/*, manifest, brand images (immutable/static)
 *  - network-first with cache fallback: public HTML pages and GET /api/public/*
 *  - network-only with /~offline fallback: HTML under /admin, /student, /trainer, /login, /register
 *  - never cached: /api/* (except GET /api/public/*), /api/files/*, non-GET requests
 *  - all caches are purged when the app logs out (POST /api/auth/logout) or on a PURGE message
 */
const VERSION = "eduskill-v2";
const OFFLINE_URL = "/~offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-192-maskable.png", "/icons/icon-512-maskable.png", "/logo-mark.svg"];
const PRIVATE_PREFIXES = ["/admin", "/student", "/trainer", "/login", "/register", "/forgot-password", "/reset-password"];
const MAX_PAGE_ENTRIES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PURGE") event.waitUntil(purgeAll());
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function purgeAll() {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  const cache = await caches.open(VERSION);
  await cache.addAll(PRECACHE).catch(() => undefined);
}

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const pages = keys.filter((r) => r.headers.get("accept")?.includes("text/html") || !new URL(r.url).pathname.includes("."));
  if (pages.length > MAX_PAGE_ENTRIES) await Promise.all(pages.slice(0, pages.length - MAX_PAGE_ENTRIES).map((r) => cache.delete(r)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Logging out clears every cached page/API response so nothing personal survives on the device.
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    event.waitUntil(purgeAll());
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/files/")) return;
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/public/")) return;

  // Immutable static assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/logo-mark.svg" || url.pathname === "/logo-mark.png") {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Public read-only API: network-first, fall back to the last good copy.
  if (url.pathname.startsWith("/api/public/")) {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
          return res;
        })
        .catch(async () => (await caches.open(VERSION)).match(req).then((c) => c || Response.error()))
    );
    return;
  }

  if (req.mode === "navigate") {
    if (isPrivatePath(url.pathname)) {
      // Portals: never cached, offline page when the network is gone.
      event.respondWith(fetch(req).catch(async () => (await caches.open(VERSION)).match(OFFLINE_URL).then((c) => c || Response.error())));
      return;
    }
    // Public pages: network-first, cached copy when offline, offline page as last resort.
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) {
            const cache = await caches.open(VERSION);
            await cache.put(req, res.clone());
            trimCache(cache);
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (await cache.match(req)) || (await cache.match(OFFLINE_URL)) || Response.error();
        })
    );
  }
});
