/* PIXEL · Game master — service worker : tout est mis en cache pour jouer hors ligne.
   Après chaque modification des fichiers, augmenter VERSION pour que les tablettes se mettent à jour. */
const VERSION = "pixel-v2.0.0";
const FICHIERS = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/scenario.js", "js/qrcode.js",
  "fonts/PlusJakartaSans-400.woff2", "fonts/PlusJakartaSans-600.woff2", "fonts/PlusJakartaSans-700.woff2", "fonts/PlusJakartaSans-800.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "img/pixel.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(rep => {
      if (rep.ok && new URL(e.request.url).origin === location.origin) {
        const copie = rep.clone(); caches.open(VERSION).then(c => c.put(e.request, copie));
      }
      return rep;
    }).catch(() => caches.match("index.html")))
  );
});
