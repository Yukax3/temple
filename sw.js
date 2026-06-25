// TEMPLE Service-Worker — App-Shell + Track-Daten offline-fähig.
//
// Was gecacht wird:
//   - App-Shell (index.html, favicon, manifest)        → cache-first
//   - playlists.json (Manifest) + data/*.json (Genres) → network-first, Cache-Fallback
//   - /api/stream Antwort (die SC-Stream-URL)          → kurz cache (beschleunigt Replay)
//
// Was NICHT gecacht wird: YouTube-Streams (verschlüsselt/dynamisch) und die
// eigentlichen SC-Audio-Segmente (fremde CDN-Origin, ToS-relevant). Die Track-
// LISTE ist aber komplett offline verfügbar — die "Bibliothek" ist auch ohne
// Netz da; nur die Wiedergabe braucht dann Online.
const CACHE = "temple-v5";   // bei jedem Shell/Daten-Update hochzählen -> Nutzer kriegen die neue Version
const SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest", "/playlists.json", "/og.svg"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
      // Genre-Dateien asynchron vorcachen (Fehler tolerant: falls eine fehlt, nicht abbrechen)
      .then(() => caches.open(CACHE))
      .then(c => fetch("/playlists.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
        .then(man => {
          if (!man || !Array.isArray(man.genres)) return;
          const slug = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
          // Stückweise vorcachen — Promise.allSettled toleriert Aussetzer (z.B. Offline beim Install)
          return Promise.allSettled(man.genres.map(g =>
            c.match("data/" + slug(g.name) + ".json").then(existing => {
              if (existing) return;
              return fetch("data/" + slug(g.name) + ".json").then(r => r.ok ? c.put("data/" + slug(g.name) + ".json", r.clone()) : null).catch(() => {});
            })
          ));
        }))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== location.origin) return;   // fremde Hosts (YT-SC-CDN) unangetastet

  // /api/stream: kurzer Cache der Stream-URL (5 Min — die URLs sind ohnehin kurz gültig).
  // Beschleunigt Replay schon gehörter SC-Tracks, ohne Audiodaten zu speichern.
  if (u.pathname === "/api/stream") {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(e.request).then(cached => {
        const net = fetch(e.request).then(r => {
          if (r.ok) { const cc = r.clone(); c.put(e.request, cc); }
          return r;
        }).catch(() => cached);
        return cached || net;
      }))
    );
    return;
  }

  if (u.pathname.endsWith(".json")) {
    // Daten (Manifest + Genre-Dateien): network-first, Fallback Cache (offline)
    e.respondWith(
      fetch(e.request).then(r => { const cc = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cc)); return r; })
        .catch(() => caches.match(e.request).then(r => r || new Response('{"genres":[]}', { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }
  // Shell/Assets: cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
