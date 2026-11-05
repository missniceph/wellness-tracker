// Offline support.
// When you're online, the app always loads the latest files from the website, so updates
// show up right away. If there's no internet (or it takes more than 3 seconds), it uses the
// copy saved on your phone instead.
// Change CACHE (e.g. ptracker-v5) whenever you publish a change: open apps notice the new
// version when they come back to the screen and reload themselves.
var CACHE = 'ptracker-v4';
var NETWORK_TIMEOUT_MS = 3000;
var FILES = ['./', 'index.html', 'css/styles.css', 'js/calc.js', 'js/app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' skips the browser's HTTP cache so we never save a stale copy.
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Set when the page itself had to come from the saved copy (slow or no internet). Its
// styles and scripts then come from the saved copy straight away instead of waiting again.
var usingSavedCopy = false;

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var isPage = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(function (cache) {
    // 'no-cache' asks the website if the file changed (cheap when it hasn't).
    var network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    var wait = !isPage && usingSavedCopy ? 0 : NETWORK_TIMEOUT_MS;
    var timeout = new Promise(function (resolve) { setTimeout(resolve, wait, null); });
    return Promise.race([network.catch(function () { return null; }), timeout]).then(function (res) {
      if (isPage) usingSavedCopy = !res;
      if (res) return res;
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) {
          e.waitUntil(network.catch(function () {})); // keep the slow download going for next time
          return cached;
        }
        return network.catch(function () {
          return req.mode === 'navigate' ? cache.match('index.html') : Response.error();
        });
      });
    });
  }));
});
