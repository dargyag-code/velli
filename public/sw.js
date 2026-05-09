// Bump del CACHE_NAME en cada release que cambie HTML/JS críticos.
// El evento `activate` elimina todos los caches con nombre distinto,
// así que cambiar este string limpia el caché viejo en TODOS los
// dispositivos que ya tenían el SW instalado.
const CACHE_NAME = 'velli-v4-2026-05-08';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('[sw] Cache addAll failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia diferenciada — fix del bug que cacheaba HTML obsoleto entre
// deploys y servía la misma versión durante semanas:
//
//   - Navegación (HTML de páginas): NETWORK-FIRST. Siempre intenta la red
//     primero para que cada deploy a Vercel se vea de inmediato. Solo cae
//     al caché si la red falla (modo offline).
//   - Assets estáticos hashed (/_next/static/*): cache-first. Su nombre
//     cambia con cada build, así que el caché viejo es seguro.
//   - Resto (imágenes, fonts): cache-first con actualización en background.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/_next/data/') || request.url.includes('/api/')) return;

  const url = new URL(request.url);
  const isNavigation =
    request.mode === 'navigate' ||
    (request.destination === 'document') ||
    request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    // Network-first: la red gana siempre que esté disponible.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match('/') || new Response('App offline', { status: 503 })
          )
        )
    );
    return;
  }

  // Cache-first para assets — _next/static tiene hash único por build.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match('/') || new Response('Offline', { status: 503 }));
    })
  );
});
