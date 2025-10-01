// Service Worker per gestione cache intelligente
const CACHE_VERSION = 'v2.0';
const CACHE_NAME = `fantacalcio-cache-${CACHE_VERSION}`;

// File da cachare (escludiamo i dati dinamici)
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css?v=2.0',
  '/script.js?v=2.0',
  '/config.js?v=2.0',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css'
];

// File che devono essere sempre aggiornati (network-first)
// Usa un pattern per gestire anche le query string con timestamp
const networkFirstPatterns = [
  /fantacalcio_data\.json/,
  /\.json$/
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia di fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const urlPath = url.pathname + url.search; // Include query string
  
  // Verifica se l'URL corrisponde ai pattern network-first
  const isNetworkFirst = networkFirstPatterns.some(pattern => pattern.test(urlPath));
  
  // Network-first per i dati JSON (sempre freschi)
  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store' // Bypass della cache HTTP
      })
        .then((response) => {
          // Non cachare le risposte JSON per garantire dati sempre aggiornati
          // Rimuovi anche dalla cache eventuali versioni precedenti
          caches.open(CACHE_NAME).then((cache) => {
            // Rimuovi tutte le versioni del file JSON
            cache.keys().then((keys) => {
              keys.forEach((key) => {
                if (networkFirstPatterns.some(pattern => pattern.test(key.url))) {
                  cache.delete(key);
                }
              });
            });
          });
          return response;
        })
        .catch((error) => {
          console.error('Network request failed:', error);
          // Se la rete fallisce, prova la cache come fallback
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('Using cached fallback for:', event.request.url);
                return cachedResponse;
              }
              throw error;
            });
        })
    );
  } 
  // Cache-first per gli altri file
  else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request)
            .then((fetchResponse) => {
              // Cacha la nuova risorsa
              return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
              });
            });
        })
    );
  }
});

// Gestione dei messaggi per forzare l'aggiornamento
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
