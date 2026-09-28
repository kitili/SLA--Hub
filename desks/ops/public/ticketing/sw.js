/**
 * Service worker — cache ticketing app shell for offline use under /ticketing/.
 */
const CACHE = "silverleaf-ops-ticketing-v1";
const BASE = "/ticketing";
const NETWORK_FIRST = [
  `${BASE}/js/config.js`,
  `${BASE}/js/env.js`,
  `${BASE}/js/api.js`,
  `${BASE}/js/api-remote.js`,
  `${BASE}/js/app.js`,
  `${BASE}/js/sync.js`,
  `${BASE}/js/offline-store.js`,
  `${BASE}/js/connectivity.js`,
  `${BASE}/js/ui.js`,
];

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/styles.css`,
  `${BASE}/js/connectivity.js`,
  `${BASE}/js/offline-store.js`,
  `${BASE}/js/api-remote.js`,
  `${BASE}/js/sync.js`,
  `${BASE}/js/api.js`,
  `${BASE}/js/ui.js`,
  `${BASE}/js/app.js`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icon.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isNetworkFirst(url) {
  if (NETWORK_FIRST.some((p) => url.pathname === p || url.pathname.endsWith(p))) return true;
  return url.pathname.startsWith(`${BASE}/js/`) && url.pathname.endsWith(".js");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(`${BASE}/`)) return;

  if (isNetworkFirst(url)) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
