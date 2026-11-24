/* Brunt · service worker: la app abre al instante y sin internet con la copia guardada; las versiones nuevas se bajan en segundo plano. */
var CACHE = 'brunt-1.1';
var FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable.png'];
/* el lector de PDF se guarda aparte: si faltara en el servidor, la app igual se instala */
var EXTRA = ['./vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES).then(function () { return Promise.all(EXTRA.map(function (u) { return c.add(u).catch(function () {}); })); }); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('brunt-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
/* compara la copia guardada con la del servidor; si cambió, la guarda y avisa a la app */
function check(req, cached) {
  var net = fetch(req || './index.html', { cache: 'no-cache' }).then(function (r) { return { r: r, cp: r && r.ok ? r.clone() : null }; });
  var upd = net.then(function (x) {
    if (!x.cp) return;
    return Promise.all([x.cp.text(), cached ? cached.clone().text() : Promise.resolve('')]).then(function (t) {
      if (!t[0] || t[0] === t[1] || t[0].indexOf('<html') < 0) return;
      return caches.open(CACHE).then(function (c) { return c.put('./index.html', new Response(t[0], { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); }).then(function () {
        if (!cached) return;
        return self.clients.matchAll({ type: 'window' }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: 'brunt-update' }); }); });
      });
    });
  }).catch(function () {});
  return { net: net, upd: upd };
}
self.addEventListener('message', function (e) {
  if (e.data === 'brunt-check') e.waitUntil(caches.match('./index.html').then(function (cached) { return check(null, cached).upd; }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    /* abre al instante con la copia guardada; la versión nueva se baja en segundo plano y la app avisa para recargar */
    var p = caches.match('./index.html').then(function (cached) { return { cached: cached, c: check(req, cached) }; });
    e.respondWith(p.then(function (o) { return o.cached || o.c.net.then(function (x) { return x.r; }, function () { return Response.error(); }); }));
    e.waitUntil(p.then(function (o) { return o.c.upd; }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (n) { if (n && n.ok) { var cp = n.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } return n; }); }));
});
