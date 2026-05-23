/* ═══════════════════════════════════════════════════════════
   SakayKo — Service Worker (sw.js)
   Caches the app shell for offline-first loading.
   Update CACHE_NAME version string when you deploy a new build.
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'sakayko-v1';

/* Files to cache immediately on install */
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ── Install: pre-cache app shell ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      /* Activate immediately without waiting for old tabs to close */
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first for app shell, network-first for API calls ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* Always go to network for GAS API calls and external tiles/fonts */
  var isExternal =
    url.origin !== location.origin ||
    url.pathname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com');

  if (isExternal) {
    /* Network-only for external resources */
    event.respondWith(fetch(event.request).catch(function() {
      return new Response('Offline — external resource unavailable.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }));
    return;
  }

  /* Cache-first strategy for local app shell files */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        /* Cache successful GET responses */
        if (event.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        /* Fallback: serve the main HTML if nothing else matches */
        return caches.match('./index.html');
      });
    })
  );
});
