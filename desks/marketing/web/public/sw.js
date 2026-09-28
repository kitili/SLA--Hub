const CACHE = 'sla-app-v2';
const SHELL = ['/', '/login', '/admin', '/marketing', '/marketing/leads', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
    await precache();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE') event.waitUntil(precache());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(handleGet(req, url));
});

async function handleGet(req, url) {
  const cache = await caches.open(CACHE);
  const isAsset = url.pathname.startsWith('/_next/static/')
    || url.pathname.endsWith('.webmanifest')
    || url.pathname === '/sw.js';

  if (isAsset) {
    const cachedAsset = await cache.match(req);
    if (cachedAsset) return cachedAsset;
  }

  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req) || await cache.match(url.pathname);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      return (await cache.match('/login'))
        || (await cache.match('/marketing/leads'))
        || (await cache.match('/marketing'))
        || (await cache.match('/'))
        || new Response('Offline. Open this app once while online, then it will work without signal.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
    return Response.error();
  }
}

async function precache() {
  const cache = await caches.open(CACHE);
  for (const path of SHELL) {
    try {
      const res = await fetch(path, { credentials: 'same-origin' });
      if (!res.ok) continue;
      await cache.put(path, res.clone());
      const html = await res.text();
      const assets = [...html.matchAll(/\/_next\/static\/[^"' )\]]+/g)].map((m) => m[0]);
      await Promise.all(assets.map(async (asset) => {
        try {
          const assetRes = await fetch(asset, { credentials: 'same-origin' });
          if (assetRes.ok) await cache.put(asset, assetRes.clone());
        } catch { /* ignore one asset */ }
      }));
    } catch { /* ignore one route */ }
  }
}
