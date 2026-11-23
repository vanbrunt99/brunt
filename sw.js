/* Brunt · service worker: la app abre sin internet. Primero la red (3 s), si no, la copia guardada. */
var CACHE = 'brunt-1.0';
var FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable.png'];
/* el lector de PDF se guarda aparte: si faltara en el servidor, la app igual se instala */
var EXTRA = ['./vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES).then(function () { return Promise.all(EXTRA.map(function (u) { return c.add(u).catch(function () {}); })); }); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('brunt-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(function (res) {
      var done = false, t = setTimeout(function () { caches.match('./index.html').then(function (r) { if (!done && r) { done = true; res(r); } }); }, 3000);
      fetch(req).then(function (r) {
        if (r && r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', cp); }); }
        if (!done) { done = true; clearTimeout(t); res(r && r.ok ? r : caches.match('./index.html').then(function (m) { return m || r; })); }
      }).catch(function () { caches.match('./index.html').then(function (r) { if (!done) { done = true; clearTimeout(t); res(r || Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (n) { if (n && n.ok) { var cp = n.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } return n; }); }));
});
