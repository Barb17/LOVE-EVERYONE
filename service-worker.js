const CACHE_STATIC_NAME = 'snd-static-cache-v2'; // Aggiornato a v2 per forzare l'aggiornamento
const CACHE_DYNAMIC_NAME = 'snd-dynamic-cache-v2'; 

const staticUrlsToCache = [
    '/',
    '/index.html',
    '/music.html',
    '/vsn.html',
    '/lab.html', // Aggiungi le tue pagine HTML qui per sicurezza
    '/style.css',
    '/music.css',
    '/favicon.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&display=swap',
    'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js' // Importante: cachiamo anche lo script 3D staticamente
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(staticUrlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_STATIC_NAME && cacheName !== CACHE_DYNAMIC_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // 1. Strategia Cache First per i MEDIA (Immagini, Audio, Video)
    if (
        requestUrl.pathname.startsWith('/MUSICA/') ||
        requestUrl.pathname.startsWith('/VIDEO/') ||
        requestUrl.pathname.startsWith('/IMMAGINE/') ||
        requestUrl.pathname.endsWith('.jpg') ||
        requestUrl.pathname.endsWith('.png') ||
        requestUrl.pathname.endsWith('.mp3') ||
        requestUrl.pathname.endsWith('.glb') // Aggiunto per i modelli 3D
    ) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(response => {
                    return caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                        // Cachiamo solo se la risposta è valida
                        if (response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }

    // 2. Strategia Network First per tutto il resto (HTML, CSS, JS esterni)
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // CORREZIONE QUI: Accettiamo anche il tipo 'cors' per le risorse esterne (Google Fonts, Model Viewer)
                if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                    return networkResponse; // Se non è cachabile ma c'è, restituiscila e basta senza cache
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            })
            .catch(() => {
                // Se sei offline, cerca nella cache
                return caches.match(event.request);
            })
    );
});