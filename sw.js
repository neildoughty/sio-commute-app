// Commute Dashboard — Service Worker
const CACHE = 'commute-v1';
const PRECACHE = [
  '/commute-dashboard.html',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// On install: cache all static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// On activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - API calls (TfL, raildata, football-data, fonts) → network first, no cache
// - Everything else → cache first, network fallback
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isApi = url.hostname.includes('tfl.gov.uk')
    || url.hostname.includes('raildata.org.uk')
    || url.hostname.includes('football-data.org')
    || url.hostname.includes('huxley2')
    || url.hostname.includes('fonts.googleapis.com')
    || url.hostname.includes('fonts.gstatic.com');

  if (isApi) {
    // Network only for live data — don't cache API responses
    e.respondWith(fetch(e.request).catch(() => new Response('{}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Cache first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Commute update';
  const options = {
    body: data.body || 'Check your commute',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/commute-dashboard.html' },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
