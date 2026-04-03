// ════════════════════════════════════════════════════════════
// SERVICE WORKER — Yota Energia Solar PWA
// Estratégia: Cache First para assets, Network First para API
// ════════════════════════════════════════════════════════════

const CACHE_NAME    = 'yota-solar-v1';
const OFFLINE_PAGE  = 'index.html';

// Arquivos para cache no install
const PRECACHE_URLS = [
  'index.html',
  'manifest.json',
];

// ── Install: cache arquivos essenciais ──
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching essential files');
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: limpar caches antigas ──
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: estratégia híbrida ──
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API calls: Network First (tenta online, falha graciosamente)
  if (url.hostname.includes('railway.app') ||
      url.hostname.includes('mongodb') ||
      url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(
          JSON.stringify({ erro: 'Sem conexão. Dados salvos localmente.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Assets: Cache First (serve do cache, atualiza em background)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Atualiza cache em background
        fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response);
            });
          }
        }).catch(function() {});
        return cached;
      }

      // Não está no cache: busca na rede
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // Offline e sem cache: serve o app principal
        return caches.match(OFFLINE_PAGE);
      });
    })
  );
});

// ── Background Sync (sincronizar quando voltar online) ──
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-proposals') {
    console.log('[SW] Syncing proposals...');
  }
});

// ── Push notifications (futuro) ──
self.addEventListener('push', function(event) {
  if (event.data) {
    var data = event.data.json();
    self.registration.showNotification(data.title || 'Yota Solar', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
    });
  }
});
