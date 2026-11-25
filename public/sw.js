const CACHE_NAME = 'submundo-cache-v0.9.1-missoes';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableResponse(response) {
  return Boolean(response && response.status === 200 && response.type === 'basic');
}

async function networkFirst(request, shouldCache, fetchInit) {
  try {
    const response = await fetch(request, fetchInit);
    if (shouldCache && isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(networkFirst(request, false, { cache: 'no-cache' }));
    return;
  }

  if (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html')
  ) {
    event.respondWith(networkFirst(request, true));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(networkFirst(request, true, { cache: 'no-cache' }));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
