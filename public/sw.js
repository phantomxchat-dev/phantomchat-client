// Phantom Chat Service Worker — v5
// Cache strategy: Network-First for navigation (app shell), Cache-First for hashed static assets.
// Scope: PhantomChat's own versioned caches only. Never touches localStorage, IndexedDB, or cookies.

const CACHE_NAME = 'phantom-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ─── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the app shell. Do NOT call skipWaiting() here — that is controlled
// by the app client (SKIP_WAITING message) so the user can choose when to update.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Network may be offline during install; fail silently — the old SW stays active.
      });
    })
  );
  // Do NOT call self.skipWaiting() here — activation is user-initiated via SKIP_WAITING message.
});

// ─── Message from app client ──────────────────────────────────────────────────
// The app sends { type: 'SKIP_WAITING' } when the user taps "Update now".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Activate ─────────────────────────────────────────────────────────────────
// Delete ONLY obsolete phantom-vN caches. Never clear any other browser storage.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('phantom-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      // Claim clients so newly activated SW takes control without a navigation.
      return self.clients.claim();
    })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept GET requests from the same origin.
  if (event.request.method !== 'GET' || !url.startsWith(self.location.origin)) {
    return;
  }

  // Never cache API calls — pass straight through to the network.
  if (url.includes('/api/')) {
    return;
  }

  // ── Navigation requests (HTML pages): Network-First ──────────────────────
  // Always try the network first so that a new index.html (with updated asset
  // hashes) is served immediately on reload. Fall back to the cache for offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Update the cached shell in the background.
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
              // Also keep the root path cached for offline fallback.
              cache.put('/', networkResponse.clone()).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: serve cached shell.
          return caches.match(event.request)
            .then((cached) => cached || caches.match('/index.html'))
            .then((cached) => cached || caches.match('/'))
            .then((cached) => cached || new Response('Offline — Phantom Chat', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            }));
        })
    );
    return;
  }

  // ── Static Assets: Cache-First with Network fallback ──────────────────────
  // Vite emits content-hashed filenames (e.g. index-BxYz1234.js) so assets
  // cached here are permanently immutable. New builds use new filenames.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Network error', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
