// Service Worker for UNO Arena — enables offline play
const CACHE_NAME = 'uno-arena-v1';

// Critical files needed for offline play
const OFFLINE_ASSETS = [
    '/',
    '/offline.html',
    '/rules.html',
    '/css/styles.css',
    '/js/offline-engine.js',
    '/manifest.json',
];

// Install: cache offline-critical assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching offline assets');
            return cache.addAll(OFFLINE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API/socket, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and socket.io
    if (event.request.method !== 'GET') return;
    if (url.pathname.startsWith('/socket.io')) return;
    if (url.pathname.startsWith('/api/')) return;

    // For HTML pages: network first, fall back to cache, then offline.html
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request).then(r => r || caches.match('/offline.html')))
        );
        return;
    }

    // For static assets: cache first, fallback to network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // If both cache and network fail, return nothing
                return new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});
