// Service worker : met le jeu en cache pour un usage hors-ligne sur mobile
const CACHE = 'ffrp-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'js/util.js', 'js/data.js', 'js/world.js', 'js/economy.js', 'js/npc.js', 'js/vehicle.js', 'js/ui.js', 'js/player.js', 'js/jobs.js', 'js/gangs.js', 'js/acts.js', 'js/phone.js', 'js/render.js', 'js/main.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
