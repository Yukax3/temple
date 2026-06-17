# TEMPLE — Underground Music Temple

Ein kompromisslos brutalistischer, minimalistischer Musik-Tempel. Eine Seite, schwarz,
harter Kontrast, Säuregrün als einziger Akzent. Musik nach Genres sortiert, **direkt auf der
Seite abspielbar** (YouTube im Hintergrund, Audio-first wie YT Music). Pflege läuft über einen
versteckten **Hub**: Link reinwerfen → automatisch ins Genre sortiert → **Publish → live**.

```
index.html        Der Tempel: Design + Player + Hub (vanilla, kein Build-Step)
playlists.json    Die Bibliothek = die Datenbank (versioniert im Repo)
api/publish.js    Serverless-Funktion: schreibt playlists.json via GitHub-API (gehärtet)
api/playlist.js   Serverless-Funktion: liest eine öffentliche Playlist in Einzeltracks aus
vercel.json       Minimal-Config
.env.example      Welche Env-Vars das Backend braucht
```

---

## So funktioniert es

- **Besucher** laden `index.html`, das `playlists.json` zieht und den Genre-Index rendert.
  Klick auf eine Zeile → Track spielt über einen versteckten YouTube-Player; Steuerung über
  die Player-Leiste unten (Play/Pause, Prev/Next, Shuffle/Repeat, Seek, Zeit). „Video"-Button
  blendet den YouTube-Player bei Bedarf sichtbar ein.
- **Du (Admin)** öffnest den Hub **nur über die geheime URL** `deine-seite.de/#<ADMIN_KEY>`.
  Es gibt absichtlich **keinen sichtbaren Button**. Der `ADMIN_KEY` steht ganz oben im Script
  von `index.html` (Default `hub-x7q2-9fk3-zm8w`) — **unbedingt in deinen eigenen langen,
  zufälligen Wert ändern** und die URL als Lesezeichen merken.
  Links (einer pro Zeile) einwerfen → **Einlesen & Sortieren**:
  - **Einzelnes Video** (`watch?v=…`, `youtu.be/…`, `music.youtube.com/…`): Titel + Kanal
    werden automatisch via oEmbed geladen — **kein API-Key**.
  - **Playlist-Link** (`…/playlist?list=…` oder `watch?v=…&list=…`): wird über `/api/playlist`
    in **lauter Einzeltracks zerlegt** — jedes Video kommt einzeln in die Warteschlange.
    Dafür braucht es den `YOUTUBE_API_KEY` (s.u.). Die Playlist muss **öffentlich** oder
    „nicht gelistet" sein — private Playlists sind nicht lesbar.
  - Das Genre wird je Track aus Titel + Kanal **geraten** (Heuristik), neue Gruppen ggf.
    automatisch angelegt. Pro Track per Dropdown **überschreibbar**.
  - **Publish** schreibt alles ins Repo → Vercel deployt neu → für alle live.

### Auto-Sortierung anpassen
Die Stichwort-Listen stehen offen in `index.html` in der Konstante `RULES`. Neue Künstler oder
Genres? Einfach Stichwörter ergänzen. Die drei Satiriker (Söllner, Wader, Widmann — inkl. der
Schreibweisen „Zöllner"/„Warder") sind bereits hinterlegt → Genre **„Satire / Liedermacher"**.

### Akzentfarbe ändern
Eine Zeile in `index.html`, CSS-Variable `--accent` (Default `#c6ff00`). Blutrot `#ff2b1d`,
Amber `#ffb000`, …

---

## Deploy (GitHub + Vercel)

1. **Repo anlegen** und pushen:
   ```bash
   git init && git add -A && git commit -m "temple"
   git branch -M main
   git remote add origin git@github.com:DEIN-NAME/temple.git
   git push -u origin main
   ```
2. **Vercel** → *Add New Project* → Repo importieren.
   Framework Preset: **Other**. Build Command: *leer*. Output Directory: *leer* (Root).
3. **Env-Vars** setzen (Project → Settings → Environment Variables), siehe `.env.example`:
   `ADMIN_PASSWORD` (≥12 Zeichen), `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`,
   `YOUTUBE_API_KEY`, optional `GITHUB_BRANCH`.
   - `GITHUB_TOKEN` = **fine-grained PAT**, nur dieses Repo, *Contents: Read and write*.
   - `YOUTUBE_API_KEY` = kostenloser **YouTube Data API v3**-Key (Google Cloud Console →
     API aktivieren → API-Schlüssel). Nur nötig für die Playlist→Einzeltracks-Funktion.
4. **Deploy.** Seite ist live. Hub öffnen: `deine-seite.de/#<ADMIN_KEY>` → Passwort → Links →
   **Publish**. (`ADMIN_KEY` vorher in `index.html` ändern!)

> Nach jedem Publish stößt der Commit einen Vercel-Redeploy an (~30 s), dann sehen alle
> Besucher die neuen Tracks. Deine eigenen, noch nicht veröffentlichten Adds siehst du sofort
> (lokal im Browser gespeichert).

---

## Lokal testen

**Nur Frontend** (Player, Hub-Sortierung, Export):
```bash
python3 -m http.server 5173
# → http://localhost:5173
```
`fetch('playlists.json')` braucht einen Server (file:// reicht nicht).

**Mit Backend** (`/api/publish` echt testen):
```bash
npm i -g vercel
cp .env.example .env.local   # Werte eintragen (am besten ein Test-Repo!)
vercel dev
```
Im Hub mit korrektem Passwort **Publish** → prüfen, dass im Repo ein neuer Commit auf
`playlists.json` landet. Falsches Passwort → `401`.

**Ohne Backend** geht immer: im Hub **„Export JSON"** → lädt `playlists.json` herunter, die du
von Hand in GitHub ersetzt.

---

## Hinweise / Caveats

- **Demo-Track:** `playlists.json` enthält in „Unsortiert" einen `▶ DEMO-TRACK`. Im Hub löschen,
  sobald deine echte Musik drin ist.
- **Sicherheit (gehärtet):** Mehrschichtig, weil die Seite öffentlich ist:
  1. **Oberfläche versteckt:** kein Button; der Hub öffnet nur unter der geheimen URL
     `#<ADMIN_KEY>` (in `index.html` ändern). Das ist *Obscurity* — der eigentliche Schutz
     liegt auf dem Server.
  2. **Server-Passwort:** Veröffentlichen geht nur mit korrektem `ADMIN_PASSWORD`, geprüft in
     `/api/publish` — **timing-sicher** (kein Timing-Leak) und mit erzwungener **Mindestlänge
     von 12 Zeichen**. Nimm ein langes Zufallspasswort (z.B. aus einem Passwortmanager).
  3. **Brute-Force-Bremse:** pro IP max. **2 Fehlversuche / 15 min**, danach `429`; jeder
     Fehlversuch wird zusätzlich verzögert. Das In-Memory-Limit gilt pro warmer Function-Instanz
     — für harte, verteilte Garantien `@upstash/ratelimit` + Vercel KV nachrüsten (Endpoint:
     `api/publish.js`).
  > Wer es noch dichter will: `/api/publish` gar nicht öffentlich deployen und `playlists.json`
  > nur lokal/über GitHub pflegen — dann gibt es keinen öffentlichen Schreib-Endpoint.
- **YouTube-ToS:** Der Player läuft versteckt (Audio-first). Ein sichtbarer Player ist laut
  YouTube-Bedingungen der saubere Weg — dafür gibt es den **„Video"**-Toggle in der Leiste.
- **Kein Upload, kein Re-Hosting:** Es werden ausschließlich YouTube-Links eingebettet und über
  den offiziellen YouTube-Player abgespielt. Es wird kein Audio kopiert oder gehostet.
