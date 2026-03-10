var CACHE_NAME = 'asciicker-v9';
var urlsToCache = [
  'fonts/cp437_6x6.png',
  'fonts/cp437_8x8.png',
  'fonts/cp437_10x10.png',
  'fonts/cp437_12x12.png',
  'fonts/cp437_14x14.png',
  'fonts/cp437_16x16.png',
  'fonts/cp437_18x18.png',
  'fonts/cp437_20x20.png',
  'index.html',
  'index.data',
  'index.js',
  'index.wasm',
  'asciicker.png',
  'asciicker.json',
  'asciicker.js'
];

self.addEventListener('install', function (event) {
	// Perform install steps
	event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
      	console.log('Opened cache');
      	return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) { return name !== CACHE_NAME; })
             .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        // Cache hit - return response
        if (response) {
      	  return response;
        }

      return fetch(event.request).then(
        function (response) {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
          	return response;
          }

          // IMPORTANT: Clone the response. A response is a stream
          // and because we want the browser to consume the response
          // as well as the cache consuming the response, we need
          // to clone it so we have two streams.
          var responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function (cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        }
      );
    })
  );
});

/*
self.addEventListener('fetch', function (event) {
// it can be empty if you just want to get rid of that error
});
*/

