// Vercel Serverless Function — GET /api/playlist?list=PLAYLIST_ID
// Liest ALLE Videos einer ÖFFENTLICHEN (oder "nicht gelisteten") YouTube-Playlist aus
// und gibt sie als Einzeltracks zurück. Mit Pagination (auch >100 Videos).
//
// Benötigte Env-Var:
//   YOUTUBE_API_KEY — kostenloser "YouTube Data API v3"-Key (Google Cloud Console).
//                     Liegt nur am Server, nie im öffentlichen Code.
//
// Hinweis: Private Playlists können NICHT gelesen werden (kein Zugriff ohne Login).

const MAX_TRACKS = 500;          // Sicherheitslimit
const SKIP_TITLES = new Set([
  "Deleted video", "Private video", "Gelöschtes Video", "Privates Video",
]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const list = (req.query.list || "").toString().trim();
  if (!list) return res.status(400).json({ error: "Parameter 'list' fehlt" });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY nicht gesetzt" });

  const tracks = [];
  let pageToken = "";

  try {
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails,status");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("playlistId", list);
      url.searchParams.set("key", key);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        const msg = (j.error && j.error.message) || `HTTP ${r.status}`;
        // 404 = Playlist nicht gefunden, 403 = Key/Quota/Privat
        const status = r.status === 404 ? 404 : r.status === 403 ? 403 : 502;
        return res.status(status).json({ error: msg });
      }

      for (const it of j.items || []) {
        const s = it.snippet || {};
        const vid = (s.resourceId && s.resourceId.videoId) ||
                    (it.contentDetails && it.contentDetails.videoId);
        const title = (s.title || "").trim();
        if (!vid || SKIP_TITLES.has(title)) continue;
        // private/deleted via status erkennbar
        const priv = it.status && it.status.privacyStatus &&
                     it.status.privacyStatus !== "public" && it.status.privacyStatus !== "unlisted";
        if (priv) continue;
        tracks.push({
          id: vid,
          title: title || vid,
          author: (s.videoOwnerChannelTitle || "").replace(/\s*-\s*Topic$/, "").trim(),
        });
      }

      pageToken = j.nextPageToken || "";
    } while (pageToken && tracks.length < MAX_TRACKS);

    return res.status(200).json({ ok: true, count: tracks.length, tracks });
  } catch (e) {
    return res.status(500).json({ error: "Serverfehler", detail: String(e).slice(0, 200) });
  }
}
