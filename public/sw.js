/* EduSkill India Foundation – offline shell service worker (hand-written, no build step).
 *
 * Rules (paths below are relative to BASE, the deployment root — "" at the domain root,
 * "/center" when the app is mounted under a sub-path):
 *  - cache-first: BASE/_next/static/*, BASE/icons/*, manifest, brand images (immutable/static)
 *  - network-first with cache fallback: public HTML pages and GET BASE/api/public/*
 *  - network-only with BASE/~offline fallback: HTML under /admin, /student, /trainer, /login, /register
 *  - never cached: BASE/api/* (except GET BASE/api/public/*), BASE/api/files/*, non-GET requests
 *  - never touched at all: anything outside BASE (another site sharing the domain)
 *  - all caches are purged when the app logs out (POST BASE/api/auth/logout) or on a PURGE message
 *
 * This file is static — it cannot read Next's env — so the deployment root is derived at runtime
 * from the registration scope that src/components/pwa/register-sw.tsx asked for.
 */

/** "" at the domain root, "/center" when registered with scope "/center/". */
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, "");
/** Builds an app path for this deployment: p("/icons") → "/icons" or "/center/icons". */
const p = (path) => BASE + path;

// Cache names are per-ORIGIN, not per-scope: namespacing by BASE keeps two deployments on the same
// domain apart, and the shared prefix is what lets us purge only our own caches (below).
const CACHE_PREFIX = "eduskill-";
const VERSION = `${CACHE_PREFIX}v2${BASE.replace(/\//g, "-")}`;
const OFFLINE_URL = p("/~offline");
const PRECACHE = [OFFLINE_URL, p("/manifest.webmanifest"), p("/icons/icon-192.png"), p("/icons/icon-512.png"), p("/icons/icon-192-maskable.png"), p("/icons/icon-512-maskable.png"), p("/logo-mark.svg")];
const PRIVATE_PREFIXES = ["/admin", "/student", "/trainer", "/login", "/register", "/forgot-password", "/reset-password"].map(p);
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
      // Only ever delete our own caches — a different app sharing this origin keeps its storage.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PURGE") event.waitUntil(purgeAll());
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function purgeAll() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
  const cache = await caches.open(VERSION);
  await cache.addAll(PRECACHE).catch(() => undefined);
}

/** True when the path belongs to this deployment (always true at the domain root). */
function inScope(pathname) {
  return !BASE || pathname === BASE || pathname.startsWith(`${BASE}/`);
}

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
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
  if (req.method === "POST" && url.pathname === p("/api/auth/logout")) {
    event.waitUntil(purgeAll());
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Requests to another app on the same domain go straight to the network, untouched and uncached.
  if (!inScope(url.pathname)) return;
  if (url.pathname.startsWith(p("/api/files/"))) return;
  if (url.pathname.startsWith(p("/api/")) && !url.pathname.startsWith(p("/api/public/"))) return;

  // Immutable static assets: cache-first.
  if (url.pathname.startsWith(p("/_next/static/")) || url.pathname.startsWith(p("/icons/")) || url.pathname === p("/manifest.webmanifest") || url.pathname === p("/logo-mark.svg") || url.pathname === p("/logo-mark.png")) {
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
  if (url.pathname.startsWith(p("/api/public/"))) {
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
