const CACHE_STATIC_NAME = 'snd-static-cache-v1'; // Per file statici che non cambiano spesso, raramente da aggiornare
const CACHE_DYNAMIC_NAME = 'snd-dynamic-cache-v1'; // Per i file cachati dinamicamente, non da aggiornare manualmente

// Lista di URL che verranno cachati all'installazione (principalmente assets statici di base)
// Questi sono i file essenziali per il funzionamento offline della pagina iniziale
const staticUrlsToCache = [
    '/',
    '/index.html',
    '/favicon.png',
    // Le icone sono generalmente statiche e importanti per la PWA
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    // Font esterni, che sono statici e fondamentali per il design
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&display=swap',
    'https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1i8q131nj-o.woff2'
];

// Installazione del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME) // Apriamo la cache statica
            .then(cache => {
                console.log('Service Worker: Caching static assets during installation');
                return cache.addAll(staticUrlsToCache);
            })
            .then(() => self.skipWaiting()) // Forza l'attivazione del nuovo SW immediatamente
            .catch(error => console.error('Service Worker: Failed to cache static assets', error))
    );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Elimina tutte le cache che non sono quelle correnti (statica o dinamica)
                    if (cacheName !== CACHE_STATIC_NAME && cacheName !== CACHE_DYNAMIC_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => clients.claim()) // Prende il controllo delle pagine esistenti
    );
});

// Strategia di cache: mista (Network First per HTML/CSS/JS, Cache First per media)
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // **********************************************
    // Strategia per i file media (MUSICA, VIDEO, Immagini Album/Immagine generica)
    // Cache First, poi Network (per performance e offline)
    // **********************************************
    if (
        requestUrl.pathname.startsWith('/MUSICA/') ||
        requestUrl.pathname.startsWith('/VIDEO/') ||
        requestUrl.pathname.startsWith('/album') && requestUrl.pathname.endsWith('.jpg') || // Cattura album.jpg, album2.jpg, ecc.
        requestUrl.pathname.startsWith('/IMMAGINE/') && requestUrl.pathname.endsWith('.jpg') // Cattura immagine.jpg, immagine2.jpg, ecc.
    ) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // Se è in cache, la restituisce
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Altrimenti, va alla rete e la mette in cache dinamica per la prossima volta
                return fetch(event.request).then(
                    response => {
                        // Controlla se la risposta è valida prima di cachare
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        return caches.open(CACHE_DYNAMIC_NAME).then(cache => {
                            cache.put(event.request, response.clone()); // Clona la risposta prima di metterla in cache
                            return response;
                        });
                    }
                ).catch(error => {
                    console.warn('Service Worker: Fetch failed for media asset:', event.request.url, error);
                    // Potresti restituire un placeholder qui se vuoi in caso di errore di rete
                    // return new Response('Offline: Media not available', { status: 503, statusText: 'Service Unavailable' });
                });
            })
        );
        return; // Termina la funzione fetch qui per i media
    }

    // **********************************************
    // Strategia per HTML, CSS, JS principali e altri file non media
    // Network First, poi Cache (per assicurare l'ultimo aggiornamento)
    // **********************************************
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Controlla se la risposta della rete è valida
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // Se la risposta non è valida, prova a recuperare dalla cache
                    return caches.match(event.request);
                }

                // Se la risposta è valida, la mette in cache e la restituisce
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_DYNAMIC_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                return networkResponse;
            })
            .catch(() => {
                // Se la rete fallisce (es. offline), prova a servire dalla cache
                console.warn('Service Worker: Network failed, serving from cache for:', event.request.url);
                return caches.match(event.request);
            })
    );
});