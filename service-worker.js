const CACHE_NAME = 'snd-vsn-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/music.html',
  '/music.css',
  '/vsn.html',
  '/vsn.css',
  '/favicon.png',
  '/album.jpg',
  '/IMMAGINE/immagine.jpg',
  '/IMMAGINE/immagine2.jpg',
  '/MUSICA/1LOVE.mp3',
  '/MUSICA/2MYSOUL.mp3',
  '/MUSICA/3BUZZ.mp3',
  '/MUSICA/4VSN.mp3',
  '/MUSICA/5IWILL.mp3',
  '/MUSICA/6STADIUM.mp3',
  '/MUSICA/7CHURCH.mp3',
  '/MUSICA/8WOLVESCRY.mp3',
  '/VIDEO/video2.mp4',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&display=swap',
  'https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1i8q131nj-o.woff2'
];

// Installazione del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Strategia di cache: Cache First, poi Network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Ritorna la risposta dalla cache se esiste
        if (response) {
          return response;
        }
        
        // Altrimenti, fetch dalla rete
        return fetch(event.request)
          .then(response => {
            // Controlla se abbiamo ricevuto una risposta valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta perché è un flusso che può essere consumato solo una volta
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});