// Bump del CACHE_NAME en cada release que cambie HTML/JS críticos.
// El evento `activate` elimina todos los caches con nombre distinto,
// así que cambiar este string limpia el caché viejo en TODOS los
// dispositivos que ya tenían el SW instalado (necesario para que el
// shell viejo no tape rutas nuevas como /planes y /planes/confirmacion).
const CACHE_NAME = 'velli-v5-2026-06-11';
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
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
//     al caché (y de ahí a /offline.html) si la red falla.
//   - Assets estáticos hashed (/_next/static/*): cache-first. Su nombre
//     cambia con cada build, así que el caché viejo es seguro.
//   - Resto (imágenes, fonts): cache-first con actualización en background.
//
// Invariantes del handler:
//   - Todo lo que NO sea GET y todo lo que vaya a /api/ se ignora por
//     completo (return sin respondWith → el browser lo maneja nativo).
//     Crítico: el checkout y el webhook de Bold jamás pasan por el SW.
//   - Cada camino que llama respondWith() resuelve SIEMPRE a un Response
//     válido, incluido el catch — un `undefined` aquí produce
//     "Failed to convert value to 'Response'" y rompe la navegación.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/data/')) return;

  const isNavigation =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html');

  event.respondWith(isNavigation ? handleNavigation(request) : handleAsset(request));
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Sin conexión. Revisa tu internet e intenta de nuevo.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}
