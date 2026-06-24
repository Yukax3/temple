// Vercel Serverless Function — POST /api/publish
// Schreibt die TEMPLE-Bibliothek über die GitHub Contents API ins Repo.
// Vercel deployt auf den Push automatisch neu → Änderung ist live.
//
// UNTERSTÜTZT ZWEI MODI (über body.mode):
//   mode:"split"  (empfohlen) — schreibt das winzige Manifest (playlists.json)
//                               + JEDE Genre-Datei in data/<slug>.json. So bleibt
//                               der Initial-Load schnell (lazy/progressiv). Das ist
//                               das Format, das tools/build.py erzeugt.
//   mode:"full"   (Legacy)    — schreibt EINE playlists.json mit allen Tracks inline.
//                               Nur für Notfälle / alte Setups. Bricht den Split-Vorteil.
//   Default (kein mode)       — "split" (das aktuelle Architektur-Ziel).
//
// HÄRTUNG (öffentliche Seite):
//   - timing-sichere Passwortprüfung (kein Timing-Leak)
//   - Mindest-Passwortlänge erzwungen (>= 12 Zeichen)
//   - Best-Effort Rate-Limiting pro IP gegen Brute-Force (+ Verzögerung bei Fehlversuch)
//   Hinweis: In-Memory-Limit gilt pro warmer Function-Instanz. Für harte, verteilte
//   Garantien Upstash/Vercel KV nutzen (siehe README) — für eine kleine Seite reicht dies.
//
// Benötigte Env-Vars (Vercel → Project → Settings → Environment Variables):
//   ADMIN_PASSWORD   — langes, zufälliges Passwort (>= 12 Zeichen!)
//   GITHUB_TOKEN     — fine-grained PAT, nur dieses Repo, Permission: Contents = Read/Write
//   GITHUB_OWNER     — z.B. dein GitHub-Username
//   GITHUB_REPO      — z.B. temple
//   GITHUB_BRANCH    — optional, Default "main"
//   GITHUB_PATH      — optional, Default "playlists.json"

import crypto from "node:crypto";

// --- Rate-Limit-State (pro warmer Instanz) ---
const FAILS = new Map();              // ip -> [timestamps]
const WINDOW_MS = 15 * 60 * 1000;     // 15 Minuten
const MAX_FAILS = 2;                  // max. 2 Fehlversuche, danach 15 min gesperrt

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff || "").split(",")[0].trim();
  return first || (req.socket && req.socket.remoteAddress) || "unknown";
}
function recentFails(ip) {
  const now = Date.now();
  const arr = (FAILS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  FAILS.set(ip, arr);
  return arr;
}
function recordFail(ip) {
  const arr = recentFails(ip);
  arr.push(Date.now());
  FAILS.set(ip, arr);
}
// konstante Zeit, auch bei unterschiedlicher Länge
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab); // Dummy, gleiche Arbeit
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

// Slug wie im Frontend/Build: normalisieren, Nicht-Alphanumerisches zu "-"
function slug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "x";
}

// Eine Datei via Contents API schreiben (PUT). Holt vorherigen SHA für Update.
async function putFile(api, gh, branch, path, content, msg) {
  const url = `https://api.github.com/repos/${api.owner}/${api.repo}/contents/${encodeURIComponent(path)}`;
  let sha;
  const cur = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: gh });
  if (cur.status === 200) {
    const j = await cur.json();
    sha = j.sha;
  } else if (cur.status !== 404) {
    const t = await cur.text();
    throw new Error(`GET ${path} fehlgeschlagen: ${t.slice(0, 200)}`);
  }
  const put = await fetch(url, {
    method: "PUT",
    headers: { ...gh, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: msg,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`PUT ${path} fehlgeschlagen: ${t.slice(0, 200)}`);
  }
  const out = await put.json();
  return out.commit ? out.commit.sha : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = clientIp(req);

  // 1) Brute-Force-Bremse: zu viele Fehlversuche?
  if (recentFails(ip).length >= MAX_FAILS) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "Zu viele Versuche. Bitte später erneut." });
  }

  const ADMIN = process.env.ADMIN_PASSWORD;
  if (!ADMIN) return res.status(500).json({ error: "ADMIN_PASSWORD nicht gesetzt" });
  if (ADMIN.length < 12) {
    return res.status(500).json({ error: "ADMIN_PASSWORD zu kurz — bitte >= 12 Zeichen setzen" });
  }

  // Body robust einlesen
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const { password, playlists, mode } = body;
  const useSplit = mode !== "full";   // Default: split (aktuelle Architektur)

  // 2) Auth — timing-sicher, mit Verzögerung bei Fehlschlag
  if (!password || !safeEqual(password, ADMIN)) {
    recordFail(ip);
    await sleep(700);
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!playlists || !Array.isArray(playlists.genres)) {
    return res.status(400).json({ error: "Ungültige Daten (genres fehlt)" });
  }

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: "GitHub-Env-Vars fehlen (GITHUB_TOKEN/OWNER/REPO)" });
  }

  const api = { owner, repo };
  const gh = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "temple-publish",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const total = playlists.genres.reduce((n, g) => n + (g.tracks ? g.tracks.length : (g.count || 0)), 0);
    const ts = (playlists.updated || new Date().toISOString());

    // ---------- SPLIT-MODUS: Manifest + data/*.json ----------
    if (useSplit) {
      let hsec = 0;
      const files = [];   // [{ path, content, msg }]

      // 1) Manifest (winzig): nur Name/Anzahl/Dauer
      const man = { version: 2, manifest: true, updated: ts, genres: [], total: 0, hsec: 0 };
      for (const g of playlists.genres) {
        const tracks = g.tracks || [];
        const durKnown = tracks.reduce((s, t) => s + (t.dur || 0), 0);
        const durCount = tracks.filter((t) => t.dur).length;
        const count = tracks.length || g.count || 0;
        man.genres.push({ name: g.name, count, durKnown, durCount });
        man.total += count;
        man.hsec += durKnown + (count - durCount) * 300;
        // Genre-Datei (nur wenn Tracks vorhanden — sonst leerlassen)
        if (tracks.length) {
          files.push({
            path: `data/${slug(g.name)}.json`,
            content: JSON.stringify({ name: g.name, tracks }, null, 1) + "\n",
          });
        }
      }
      files.unshift({
        path: "playlists.json",
        content: JSON.stringify(man, null, 1) + "\n",
      });

      // Sequentiell schreiben (GitHub-Rate-Limit schonend; eh nur wenige/Many kleine Files)
      const commits = [];
      let i = 0;
      for (const f of files) {
        i++;
        const msg = `temple: ${f.path} (${i}/${files.length})`;
        const c = await putFile(api, gh, branch, f.path, f.content, msg);
        commits.push({ path: f.path, sha: c });
      }
      return res.status(200).json({
        ok: true,
        mode: "split",
        files: commits.length,
        total,
        manifest: man.total,
      });
    }

    // ---------- FULL-MODUS (Legacy): eine playlists.json ----------
    const content = JSON.stringify(playlists, null, 2) + "\n";
    const path = process.env.GITHUB_PATH || "playlists.json";
    const sha = await putFile(api, gh, branch, path, content, `temple: update library (${total} tracks, legacy full)`);
    return res.status(200).json({ ok: true, mode: "full", commit: sha, total });
  } catch (e) {
    return res.status(502).json({ error: "Publish fehlgeschlagen", detail: String(e.message || e).slice(0, 300) });
  }
}
