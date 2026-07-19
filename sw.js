/**
 * QUIZPDF AI — Service Worker
 * sw.js
 *
 * Strategy: Cache-first for shell assets, network-first for API calls.
 */

const CACHE_NAME   = 'quizpdfai-v8';
const RUNTIME_NAME = 'quizpdfai-runtime-v8';

// Shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/animations.css',
  './css/pages.css',
  './js/store.js',
  './js/router.js',
  './js/app.js',
  './js/pdf-extractor.js',
  './js/gemini-client.js',
  './js/firebase-client.js',
  './js/utils/theme.js',
  './js/utils/toast.js',
  './js/pages/home.js',
  './js/pages/quiz.js',
  './js/pages/results.js',
  './js/pages/review.js',
  './js/pages/settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// ── Install: pre-cache shell ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching shell assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, RUNTIME_NAME];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !validCaches.includes(k))
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fallback to network ─────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip Google Fonts (network only)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for shell assets
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const clone = response.clone();
            caches.open(RUNTIME_NAME).then(cache => cache.put(request, clone));
            return response;
          })
          .catch(() => {
            // Offline fallback to index.html for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ── Message: skip waiting ────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
