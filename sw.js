// Updated service worker with better caching
const CACHE_NAME = 'connectme-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
  'https://cdn-icons-png.flaticon.com/512/733/733585.png',
  'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
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

self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: 'New Message',
    body: 'You have a new notification',
    icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: data.vibrate,
      data: data.data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      if (clientList.length > 0) {
        const client = clientList[0];
        if ('focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

self.addEventListener('message', event => {
  if (event.data.action === 'show-notification') {
    self.registration.showNotification(
      event.data.title,
      {
        body: event.data.body,
        icon: event.data.icon,
        badge: event.data.badge,
        vibrate: event.data.vibrate,
        data: event.data.data
      }
    );
  }
});