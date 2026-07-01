/* ================================================================
   LVEVR — Service Worker
   ================================================================
   Strategia:
   - Pagine HTML (navigazione): NETWORK-FIRST.
     Ad ogni apertura, se il dispositivo è online, viene scaricata
     SEMPRE la versione più recente pubblicata su GitHub Pages.
     Questo garantisce che la web app sia costantemente allineata
     al sito web, senza bisogno di ripubblicare la web app stessa.
   - Altre risorse (immagini, audio, font, script esterni ecc.):
     STALE-WHILE-REVALIDATE. Vengono servite subito dalla cache
     (per velocità e supporto offline) mentre in background viene
     scaricata e salvata una versione aggiornata per la volta
     successiva.
   - Se il dispositivo è offline, si usa l'ultima versione salvata
     in cache come fallback.
   ================================================================ */

// La cache è stata aggiornata alla v2 per forzare il download dei nuovi file
const CACHE_NAME = 'lvevr-cache-v3';

const PRECACHE_URLS = [
    './index.html',
    './manifest.json',
    './icons/icona.svg',
    './icons/icona192.png',
    './icons/icona512.png'
];

// INSTALL: pre-carica le risorse essenziali e attiva subito la nuova versione
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// ACTIVATE: elimina le cache vecchie e prende il controllo subito
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// FETCH
self.addEventListener('fetch', event => {
    const request = event.request;

    // Ignora richieste non-GET (es. POST verso Formspree)
    if (request.method !== 'GET') return;

    // Navigazione / pagine HTML -> NETWORK FIRST
    if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return networkResponse;
                })
                .catch(() =>
                    caches.match(request).then(cached => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // Tutto il resto -> STALE WHILE REVALIDATE
    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(request).then(cachedResponse => {
                const fetchPromise = fetch(request)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        )
    );
});

// Consente all'app di forzare l'attivazione immediata di una nuova versione
// (usato dallo script in index.html)
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});