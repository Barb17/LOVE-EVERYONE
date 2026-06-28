/**
 * sw.js — Service Worker per VSN PWA
 *
 * Strategia: NETWORK FIRST
 * ─────────────────────────────────────────────────────────────────
 * Ad ogni richiesta si tenta PRIMA la rete.
 * Se la rete risponde → aggiorna la cache e restituisce la risposta fresca.
 * Se la rete fallisce (offline) → serve dalla cache come fallback.
 *
 * In questo modo la web app è sempre aggiornata: ogni volta che
 * il sito viene modificato, la prossima apertura della PWA scarica
 * automaticamente la versione più recente, esattamente come un browser.
 *
 * Il numero di versione qui sotto NON è necessario cambiarlo ad ogni
 * aggiornamento del sito — la strategia Network First provvede da sola.
 * Cambialo solo se vuoi forzare la pulizia completa della cache.
 */

const CACHE_NAME = 'vsn-cache-v1';

/**
 * Lista delle risorse da pre-cachare all'installazione.
 * Sono le risorse "shell" minime per poter avviare l'app offline
 * anche al primo tentativo (se si è navigato almeno una volta online).
 */
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json'
];

/* ─── INSTALL ─────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Pre-cache solo le risorse essenziali; gli errori non bloccano l'installazione
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  // Attiva subito senza attendere la chiusura delle schede precedenti
  self.skipWaiting();
});

/* ─── ACTIVATE ────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))   // rimuove cache obsolete
      )
    )
  );
  // Prende il controllo di tutte le schede aperte immediatamente
  self.clients.claim();
});

/* ─── FETCH — Network First ────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;

  // Gestisci solo richieste GET sullo stesso dominio (o relative)
  if (request.method !== 'GET') return;

  // Escludi richieste verso API esterne (Formspree, Google Fonts, CDN…)
  // per non appesantire la cache con risorse di terze parti
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isFontOrCDN  = /fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\.googleapis\.com|cdnjs\.cloudflare\.com|formspree\.io/.test(url.hostname);

  if (!isSameOrigin && !isFontOrCDN) return; // lascia passare senza intercettare

  event.respondWith(networkFirst(request));
});

/**
 * networkFirst(request)
 * Prova la rete; in caso di errore usa la cache.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // 1. Tenta la rete (timeout implicito del browser)
    const networkResponse = await fetch(request);

    // 2. Se la risposta è valida, aggiorna la cache in background
    if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (_err) {
    // 3. Rete non disponibile → fallback dalla cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // 4. Niente in cache: per la pagina principale restituisce index.html
    if (request.mode === 'navigate') {
      const indexCached = await cache.match('./index.html');
      if (indexCached) return indexCached;
    }

    // 5. Risorsa non trovata né in rete né in cache
    return new Response('Risorsa non disponibile offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/* ─── BACKGROUND SYNC: notifica aggiornamento alle schede aperte ── */
/**
 * Quando il SW rileva che ha servito una risposta diversa da quella
 * in cache (cioè il sito è stato aggiornato), può notificare le schede
 * aperte. Qui usiamo un approccio semplice: inviamo un messaggio
 * "UPDATE_AVAILABLE" al client attivo. La pagina può reagire mostrando
 * un banner "Aggiornamento disponibile — ricarica" o ricaricare in silenzio.
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
