// sw.js — Service Worker for dynamic asset caching.
// Strategy: cache-first with network fallback.
//   - First visit: all files load normally from the network and are cached silently.
//   - Return visits: files are served instantly from local cache.
//   - New files added to the game are cached automatically on first request.
//   - To force all players to re-download everything (e.g. after a major update),
//     bump the CACHE_NAME version below.

const CACHE_NAME = 'axiom-zero-v1';

// Files to never cache — always fetch fresh from the network.
const BYPASS_CACHE = [
    'https://sdk.crazygames.com/crazygames-sdk-v3.js',
];

// On install, claim all clients immediately so the new version takes effect right away.
// This ensures bug fixes and updates are live without waiting for tabs to close.
self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('fetch', function(e) {
    const url = e.request.url;

    // Skip non-GET requests and bypassed URLs
    if (e.request.method !== 'GET') return;
    if (BYPASS_CACHE.some(function(u) { return url.startsWith(u); })) return;

    e.respondWith(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.match(e.request).then(function(cached) {
                if (cached) return cached;

                // Not in cache — fetch from network and store for next time
                return fetch(e.request).then(function(response) {
                    // Only cache valid responses (not errors, not opaque cross-origin)
                    if (response.ok) {
                        cache.put(e.request, response.clone());
                    }
                    return response;
                });
            });
        })
    );
});

// On activation, delete any caches from old versions
self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) { return key !== CACHE_NAME; })
                    .map(function(key) { return caches.delete(key); })
            );
        })
    );
});
