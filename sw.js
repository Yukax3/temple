// TEMPLE Service-Worker — App-Shell offline-fähig, Daten network-first.
// (YouTube/SoundCloud werden NIE gecacht — nur eigene Origin-GETs.)
const CACHE = "temple-v2";   // bei jedem index.html/Shell-Update hochzählen -> Nutzer bekommen die neue Version
const SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest", "/playlists.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // fremde Hosts (YT/SC) unangetastet
  if (u.pathname.endsWith(".json")) {
    // Daten: network-first, Fallback Cache (offline)
    e.respondWith(
      fetch(e.request).then(r => { const cc = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cc)); return r; })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Shell/Assets: cache-first
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
