var CACHE_NAME = 'crm-v20260416a4';
var URLS_TO_CACHE = [
  './',
  './index.html'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Google Apps Script 請求不走快取
  if (e.request.url.includes('script.google.com') || e.request.url.includes('drive.google.com')) {
    return;
  }
  // 只快取 GET 且同源的請求
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(resp) {
      // 只快取 2xx 且非 opaque 的回應
      if (resp && resp.ok && resp.type === 'basic') {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
      }
      return resp;
    }).catch(function() {
      // 離線時用快取，找不到就回 503
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('離線且無快取', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
