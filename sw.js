// App shell in cache all'installazione; i volumi della Valtorta vengono salvati alla prima lettura.
const CACHE = 'vangelo-valtorta-v7';
const CORE = ['./', 'index.html', 'style.css', 'calendario.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return;   // Vangelo del giorno: sempre dalla rete (l'app tiene una sua copia)

  // Pagina, script e indice: prima la rete (aggiornamenti immediati), la cache se offline.
  if (sameOrigin && !/\/data\/(vol\d+\.json|[^/]+\.bin)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request.url, { cache: 'no-cache' })  // salta la cache HTTP di 10 minuti di GitHub Pages
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  // Dati cifrati: l'indirizzo contiene la versione (?v=...), quindi la copia salvata vale per sempre;
  // quando cambia la versione (nuova chiave) si scarica il file nuovo e si butta il vecchio.
  if (url.pathname.endsWith('.bin')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) {
          for (const old of await cache.keys()) {
            const o = new URL(old.url);
            if (o.pathname === url.pathname && o.search !== url.search) cache.delete(old);
          }
          await cache.put(e.request, res.clone());
        }
        return res;
      })
    );
    return;
  }

  // Volumi in chiaro e font: dalla cache se presenti, aggiornati in background
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
