// Service Worker V2 pour AuvergneTech PWA — Feature 53: Mode hors-ligne complet
const CACHE_NAME = 'auvergnetech-v2';
const OFFLINE_URL = '/offline.html';
const CDN_CACHE = 'auvergnetech-cdn-v1';

// Ressources à mettre en cache immédiatement
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

// CDN assets (Three.js pour 3D offline)
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

// Ressources API à mettre en cache avec stratégie Network First
const API_CACHE_NAME = 'auvergnetech-api-v2';

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation V2...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Cache ressources statiques');
        return cache.addAll(PRECACHE_ASSETS);
      }),
      caches.open(CDN_CACHE).then((cache) => {
        console.log('[SW] Cache CDN (Three.js)');
        return cache.addAll(CDN_ASSETS).catch(() => console.log('[SW] CDN cache skipped (offline)'));
      }),
    ]).then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation V2...');
  const keepCaches = [CACHE_NAME, API_CACHE_NAME, CDN_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!keepCaches.includes(cacheName)) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Stratégie pour CDN (Three.js etc.) — Cache first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('cdn.')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Stratégie pour les requêtes API Supabase
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Stratégie pour les assets statiques
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Stratégie par défaut : Network First avec fallback offline
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// Stratégie Cache First (pour assets statiques)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Erreur fetch:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Stratégie Network First (pour API)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Réseau indisponible, utilisation du cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Network First avec fallback page offline
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retourner la page offline pour les requêtes de navigation
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Écouter les messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_ASCENSEURS') {
    cacheAscenseursData(event.data.data);
  }
  
  // Feature 53: Cache tolerie pieces for offline
  if (event.data && event.data.type === 'CACHE_TOLERIE') {
    cacheTolerieData(event.data.data);
  }
});

// Fonction pour mettre en cache les données ascenseurs
async function cacheAscenseursData(data) {
  const cache = await caches.open(API_CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put('/api/ascenseurs-cache', response);
  console.log('[SW] Données ascenseurs mises en cache');
}

// Notification de mise à jour disponible
self.addEventListener('message', (event) => {
  if (event.data === 'checkForUpdate') {
    self.registration.update();
  }
});

// Feature 53: Cache tolerie pieces offline
async function cacheTolerieData(data) {
  const cache = await caches.open(API_CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put('/api/tolerie-pieces-cache', response);
  console.log('[SW] Pièces tôlerie mises en cache:', data.length, 'pièces');
}
