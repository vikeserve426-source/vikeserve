// VikeServe Service Worker - Enhanced Version
const CACHE_NAME = 'vikeserve-v2';
const DYNAMIC_CACHE = 'vikeserve-dynamic-v1';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/style.css',
  '/manifest.json'
];

// Helper: Check if request is external API
function isExternalAPI(url) {
  return url.includes('firebase') ||
         url.includes('googleapis') ||
         url.includes('intasend') ||
         url.includes('firestore.googleapis.com');
}

// Helper: Check if request is image
function isImage(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

// Install event - cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching core assets');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Cache addAll failed:', err))
  );
  self.skipWaiting();
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Skip external APIs
  if (isExternalAPI(url)) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // HTML pages - Network first, fallback to cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Images - Cache first (fastest)
  if (isImage(url)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            const copy = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              // Check size before caching
              const size = response.headers.get('content-length');
              if (!size || parseInt(size) < 5 * 1024 * 1024) {
                cache.put(event.request, copy);
              }
            });
            return response;
          });
        })
    );
    return;
  }
  
  // Default: Cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, copy);
          });
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE];
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Push notification event
self.addEventListener('push', event => {
  let data = { title: 'VikeServe', body: 'New update!' };
  
  try {
    data = event.data.json();
  } catch {
    data.body = event.data.text();
  }
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message event for client communication
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  const cache = await caches.open('pending-actions');
  const requests = await cache.keys();
  
  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
        console.log('✅ Synced pending action:', request.url);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }
}

console.log('🚀 VikeServe Service Worker loaded');