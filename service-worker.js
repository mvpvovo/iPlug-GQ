const CACHE_NAME = 'iplug-gq-v2.0';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './pwa.js',
  './manifest.json',
  './events.csv',
  'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache assets gracefully (allow optional ones to fail without breaking install)
        return Promise.allSettled(
          APP_SHELL.map(url =>
            fetch(url, { mode: url.startsWith('http') && !url.startsWith(self.location.origin) ? 'cors' : 'same-origin' })
              .then(res => {
                if (res.ok || res.type === 'opaque') {
                  return cache.put(url, res);
                }
              })
              .catch(err => console.warn('[SW] Pre-cache failed for:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker & Clean Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Stale-While-Revalidate for events.csv
  if (url.pathname.endsWith('events.csv')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-first for images, fonts, stylesheets, scripts
  const isStaticAsset =
    url.hostname.includes('imagekit.io') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            if (response.ok || response.type === 'opaque') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // If image fails, return nothing or cached fallback
            return cached;
          });
      })
    );
    return;
  }

  // Network-first with cache fallback for navigation / documents
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
  );
});

// Handle Push Notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New event reminder from iPlug GQ!',
      icon: 'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png',
      badge: 'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || './'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'iPlug GQ', options)
    );
  } catch (e) {
    console.error('[SW] Push notification error:', e);
  }
});

// Handle Notification Click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
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
