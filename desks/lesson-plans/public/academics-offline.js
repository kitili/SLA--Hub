/**
 * Keeps the four Academics boards on this device.
 *
 * Online visits store the page and its scripts. Offline visits open that
 * copy. A database error is not stored, so a failed refresh cannot replace
 * the last good copy. Sign-in, admin, and lesson plans are left untouched.
 */
const CACHE = "academics-boards-v1";
const BOARD = /^\/(en|sw)\/(feedback|curriculum|kg|assessment)\/?$/;
const MARKER = 'data-academics-cache="1"';

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("academics-boards-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isDocument(request) {
  if (request.headers.get("RSC") === "1") return false;
  if (request.headers.get("Next-Router-Prefetch")) return false;
  if (request.mode === "navigate") return true;
  return (request.headers.get("accept") || "").includes("text/html");
}

function boardRequest(url) {
  return new Request(url.origin + url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const board = BOARD.test(url.pathname);
  const asset = url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg";
  if (!board && !asset) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok && asset) {
          await cache.put(request, response.clone());
        }
        if (response && response.ok && board && isDocument(request)) {
          const text = await response.clone().text();
          const body = text.replace(/<script[\s\S]*?<\/script>/gi, "");
          if (body.includes(MARKER)) await cache.put(boardRequest(url), response.clone());
        }
        return response;
      } catch {
        if (board && isDocument(request)) {
          const saved = await cache.match(boardRequest(url));
          if (saved) return saved;
        }
        if (asset) {
          const saved = await cache.match(request, { ignoreSearch: true });
          if (saved) return saved;
        }
        return new Response("Open this dashboard once while you are online.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
