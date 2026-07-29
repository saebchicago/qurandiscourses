// Service worker — offline shell + bundled-data caching. Never touches
// cross-origin requests (api.alquran.cloud, cdn.islamic.network): those
// keep using the site's existing localStorage API cache and the browser's
// own audio range-request handling untouched.
//
// Bump SW_VERSION whenever a data file's schema changes (see any
// scripts/build-*.mjs change) or a cached asset's contract changes, so
// stale entries from the previous version are dropped on activate. This
// is a documented convention, not a checker — see docs/maintainer-guide.md.
const SW_VERSION = "v5";
const HTML_CACHE = "dd-html-" + SW_VERSION;
const ASSET_CACHE = "dd-assets-" + SW_VERSION;
const DATA_CACHE = "dd-data-" + SW_VERSION;
const OWN_CACHES = [HTML_CACHE, ASSET_CACHE, DATA_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !OWN_CACHES.includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// HTML documents: network-first, cache fallback for offline. Cached under
// the path alone (query string stripped) — a page's shell markup doesn't
// vary by query param (read.html?s=/a=/hl= are all read client-side after
// load), so this keeps the cache to one entry per page instead of growing
// unboundedly with every distinct deep link.
async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);
  const keyUrl = new URL(request.url);
  keyUrl.search = "";
  const cacheKey = new Request(keyUrl.toString());
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

// data/*.json: network-first, NOT stale-while-revalidate. A schema change
// (like the root-refs format change in this same PR) must never be paired
// with a stale cached copy just because the network happened to be slow;
// only an actual offline/network failure should fall back to cache.
async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// assets/*: stale-while-revalidate. Static JS/CSS/fonts change rarely and
// aren't schema-sensitive, so serving the cached copy immediately (if any)
// while refreshing in the background is safe and fast.
function staleWhileRevalidateAsset(event) {
  const request = event.request;
  return caches.open(ASSET_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(fetchPromise);
        return cached;
      }
      return fetchPromise;
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin requests are never intercepted — this is the one rule
  // that must never regress, since it's what keeps the existing
  // localStorage-based alquran.cloud cache and cdn.islamic.network audio
  // range requests working exactly as before.
  if (url.origin !== self.location.origin) return;

  const isHtml =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");
  if (isHtml) {
    event.respondWith(networkFirstHtml(request));
    return;
  }
  if (url.pathname.startsWith("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith(networkFirstData(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidateAsset(event));
    return;
  }
  // Everything else (manifest, sw.js itself, icons, sitemap, robots) is
  // left to the browser's default handling — no caching strategy needed.
});
