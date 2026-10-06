// Service worker : l'app fonctionne hors ligne après la première visite.
// À CHAQUE nouvelle version de l'app, changez le numéro de CACHE ci-dessous.
// Les données des étudiants (IndexedDB) ne sont jamais touchées ici.
const CACHE = 'namako-v12';
const LIBS = 'namako-libs';   // bibliothèques de scan (PDF, OCR), conservées d'une version à l'autre
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'db.js', 'backup.js', 'review.js', 'config.js', 'codec.js', 'license.js', 'scan.js', 'spell.js', 'qr.js', 'packs.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LIBS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réponse immédiate depuis le cache, mise à jour en arrière-plan si le réseau répond.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const host = new URL(req.url).hostname;
  if (req.method === 'GET' && (host === 'cdnjs.cloudflare.com' || host === 'cdn.jsdelivr.net')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(LIBS).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.endsWith('version.json')) return;   // toujours lu sur le réseau
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      });
      if (hit) { net.catch(() => {}); return hit; }
      return net.catch(() => caches.match('index.html'));
    })
  );
});
