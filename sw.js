var CACHE_NAME = 'crm-v303';
var URLS_TO_CACHE = [
  './',
  './房仲客戶管理系統.html'
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
  e.respondWith(
    fetch(e.request).then(function(resp) {
      // 更新快取
      var clone = resp.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
      return resp;
    }).catch(function() {
      // 離線時用快取
      return caches.match(e.request);
    })
  );
});
