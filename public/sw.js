/* ═══════════════════════════════════════════════
   Ponto Facial — Service Worker (Offline Support)
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'ponto-facial-v3';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/faceRecognition.js',
  '/js/app.js',
  '/js/vendor/face-api.js',
  '/js/vendor/jspdf.umd.min.js',
  '/js/vendor/jspdf.plugin.autotable.min.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_tiny_model-weights_manifest.json',
  '/models/face_landmark_68_tiny_model-shard1',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
  '/models/face_recognition_model-shard2'
];

// Install Event — Cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell & AI models...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network-First for API, Cache-First for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for API calls (let server handle DB queries)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Você está offline do servidor local' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Cache-First strategy for static UI & AI models
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
