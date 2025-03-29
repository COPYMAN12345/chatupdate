// Service Worker for P2P Chat App
const CACHE_NAME = 'p2p-chat-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  'https://cdn-icons-png.flaticon.com/512/733/733585.png',
  'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
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
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: 'New Message',
    body: 'You have a new notification',
    icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      vibrate: data.vibrate,
      data: data.data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
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
        vibrate: event.data.vibrate,
        data: event.data.data
      }
    );
  }
});