const CACHE_STATIC_NAME = 'snd-static-cache-v1';
const CACHE_DYNAMIC_NAME = 'snd-dynamic-cache-v1';

// Lista di URL che verranno cachati all'installazione (SOLO file locali)
const staticUrlsToCache = [
    '/',
    '/index.html',
    '/favicon.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
    // RIMOSSO: I link a Google Fonts. Lasciamo che li gestisca il browser.
];

// Installazione del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                // Ora questo è molto più affidabile
                return cache.addAll(staticUrlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(error => console.error('Service Worker: Failed to cache static assets', error))
    );
});

// Attivazione del Service Worker
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


// Intercettazione delle richieste
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // **********************************************
    // AGGIUNTO: ESCAPE HATCH PER RICHIESTE CROSS-ORIGIN
    // Se la richiesta non è per il nostro dominio (es. Google APIs, Fonts, model-viewer)
    // la ignoriamo e lasciamo che sia il browser a gestirla.
    // Questo risolve tutti gli errori net::ERR_FAILED e TypeError.
    // **********************************************
    if (requestUrl.origin !== self.location.origin) {
        return; // Non chiamare event.respondWith()
    }

    // **********************************************
    // Strategia per i file media (Cache First)
    // (Ora si applica solo ai file locali, quindi è sicura)
    // **********************************************
    if (
        requestUrl.pathname.startsWith('/MUSICA/') ||
        requestUrl.pathname.startsWith('/VIDEO/') ||
        requestUrl.pathname.startsWith('/album') && requestUrl.pathname.endsWith('.jpg') ||
        requestUrl.pathname.startsWith('/IMMAGINE/') && requestUrl.pathname.endsWith('.jpg')
    ) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request).then(
                    response => {
                        // Il controllo 'basic' ora è corretto, dato che gestiamo solo file locali
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        return caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                            return response;
                        });
                    }
                ).catch(error => {
                    console.warn('Service Worker: Fetch failed for media asset:', event.request.url, error);
                    // MODIFICATO: Restituisci una Response valida in caso di errore
                    return new Response('Media non disponibile offline', {
                        status: 404,
                        headers: { "Content-Type": "text/plain" }
                    });
                });
            })
        );
        return; 
    }

    // **********************************************
    // Strategia per HTML, CSS, JS (Network First)
    // (Ora si applica solo ai file locali)
    // **********************************************
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Il controllo 'basic' ora è corretto
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // Tenta il fallback sulla cache se la rete dà una risposta non valida
                    return caches.match(event.request);
                }

                // Risposta valida, la mettiamo in cache e la restituiamo
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_DYNAMIC_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                return networkResponse;
            })
            .catch(() => {
                // MODIFICATO: Se la rete fallisce (offline), gestiamo correttamente il fallback
                console.warn('Service Worker: Network failed, serving from cache for:', event.request.url);
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se non è nemmeno in cache, restituisci una Response di errore valida
                    return new Response('Pagina non disponibile offline', {
                        status: 404,
                        headers: { "Content-Type": "text/plain" }
                    });
                });
            })
    );
});