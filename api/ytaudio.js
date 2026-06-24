// Vercel Serverless Function — GET /api/ytaudio?id=<youtube_video_id>
// Löst eine YouTube-Video-ID in eine direkte, im <audio> abspielbare Audio-Stream-URL auf.
//
// Wozu: YouTube-Iframes pausieren auf iOS, sobald der Browser in den Hintergrund geht.
// Ein NATIVES <audio>-Element mit einer direkten Stream-URL läuft dagegen im Hintergrund
// + Lock-Screen weiter (mit MediaSession). Genau wie /api/stream für SoundCloud.
//
// Quelle: Piped API (offener YouTube-Proxy, keine Keys nötig).
// Fallback: pipedapi.kavin.rocks → pipedapi.adminforge.de → pipedapi.in.projectsegfau.lt
//
// Ehrlich: Piped ist ein Drittanbieter-Dienst. Wenn er down ist oder YT blockiert,
// fällt der Endpoint zurück aufs IFrame (Frontend-Handling). Alternativ: yt-dlp
// auf einem eigenen Server ( nicht Vercel-freundlich).
//
// Audio-Codec-Priorität:
//   1. opus (webm) — beste Qualität bei niedrigster Bitrate, Safari ab 14.1
//   2. mp4/aac (m4a) — breit kompatibel, Safari-Fallback
//   3. beliebiger audio-Stream — besser als gar nichts

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";

// Piped-Instanzen (in Reihenfolge versuchen)
const PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
];

// Cache: videoId -> { url, mime, ts }
const cache = new Map();
const TTL = 4 * 60 * 1000;  // 4 Min ( YT-Stream-URLs sind kurzlebig)

async function fetchPiped(videoId) {
  for (const base of PIPED) {
    try {
      const r = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || !j.audioStreams) continue;

      // Sortiere nach Bitrate (höchste zuerst), preferiere opus/m4a
      const streams = j.audioStreams
        .filter(s => s.url && s.mimeType && s.bitrate)
        .sort((a, b) => {
          const aOpus = a.mimeType.includes("opus") ? 100 : 0;
          const bOpus = b.mimeType.includes("opus") ? 100 : 0;
          const aAac = a.mimeType.includes("mp4") ? 50 : 0;
          const bAac = b.mimeType.includes("mp4") ? 50 : 0;
          if ((aOpus + a.bitrate) !== (bOpus + b.bitrate))
            return (bOpus + b.bitrate) - (aOpus + a.bitrate);
          return (bAac + b.bitrate) - (aAac + a.bitrate);
        });

      if (streams.length) {
        const pick = streams[0];
        return {
          url: pick.url,
          mime: pick.mimeType,
          bitrate: pick.bitrate,
          title: j.title || "",
          duration: (j.duration || 0) * 1000,  // Piped liefert Sekunden
        };
      }
    } catch (_) {
      // Diese Instanz gescheitert -> nächste
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = (req.query.id || "").toString().trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Parameter 'id' (11-Zeichen YouTube-Video-ID) fehlt" });
  }

  try {
    // Cache prüfen
    const cached = cache.get(id);
    if (cached && Date.now() - cached.ts < TTL) {
      return res.status(200).json({ url: cached.url, mime: cached.mime, title: cached.title, duration: cached.duration });
    }

    const result = await fetchPiped(id);
    if (!result) {
      return res.status(502).json({
        error: "Kein Audio-Stream gefunden (Piped nicht erreichbar oder Block)",
        hint: "Frontend sollte auf IFrame-Fallback zurückfallen.",
      });
    }

    // Cachen
    cache.set(id, { url: result.url, mime: result.mime, title: result.title, duration: result.duration, ts: Date.now() });

    res.setHeader("Cache-Control", "public, max-age=240");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
