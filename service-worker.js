// CampusTrade CU2 - Service Worker
// - HTML/JS/CSS propios: network-first (siempre intenta la versión nueva; la caché solo es respaldo offline)
// - CDN estáticos (Tailwind, fuentes, Font Awesome, Firebase SDK): cache-first
// - Firestore y demás APIs: se dejan pasar sin interceptar

const CACHE_NAME = 'campustrade-cu2-v2'; // Súbelo a v3, v4... cuando cambies este archivo

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './portal-vendedor.html',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/portal-vendedor.js',
  './js/initial-data.js',
  './js/map-data.js',
  './assets/logo.svg',
  './assets/cu2-map.jpg',
  './manifest.json'
];

const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com' // Firebase SDK (firebasejs)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Cache addAll error during install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.includes(url.hostname);

  // Firestore, googleapis, analytics, etc.: no interceptar
  if (!isSameOrigin && !isCdn) return;

  // Recursos propios: NETWORK-FIRST
  if (isSameOrigin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            // Sin red y sin caché: para páginas, volver al inicio
            if (request.mode === 'navigate') return caches.match('./index.html');
            return Response.error();
          })
        )
    );
    return;
  }

  // CDN estáticos: CACHE-FIRST
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      });
    })
  );
});