// Service Worker for Music Player PWA
// Enables offline functionality and caches the app shell

const CACHE_NAME = 'music-player-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/script.js',
    '/manifest.json'
];

// Install event - cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache all static assets
            return cache.addAll(STATIC_ASSETS).catch((error) => {
                console.warn('Failed to cache some assets:', error);
                // Don't let cache failures prevent installation
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim(); // Take control immediately
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http schemes
    if (!event.request.url.startsWith('http')) {
        return;
    }

    // For navigation requests (HTML pages)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request)
                .then((response) => response || fetch(event.request))
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // For other requests (CSS, JS, images, etc.)
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached version if available
            if (response) {
                return response;
            }

            // Otherwise fetch from network and cache it
            return fetch(event.request)
                .then((response) => {
                    // Only cache successful responses
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    // Clone the response to cache it
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        // Double check the URL before caching
                        if (event.request.url.startsWith('http')) {
                            cache.put(event.request, responseToCache);
                        }
                    }).catch((err) => {
                        console.log('Cache put failed:', err);
                    });

                    return response;
                })
                .catch(() => {
                    // Return cached version if network fails
                    return caches.match(event.request);
                });
        })
    );
});

// Background sync for future features (commented out for now)
/*
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-playlist') {
        event.waitUntil(syncPlaylist());
    }
});

async function syncPlaylist() {
    try {
        // Sync playlist with server
        const response = await fetch('/api/playlist');
        return response.json();
    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}
*/

// Periodic background sync (iOS doesn't fully support this yet)
// But we include it for completeness and future Safari support
/*
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-metadata') {
        event.waitUntil(updateMetadata());
    }
});
*/
