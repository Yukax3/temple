// Vercel Serverless Function — POST /api/publish
// Schreibt playlists.json über die GitHub Contents API ins Repo.
// Vercel deployt auf den Push automatisch neu → Änderung ist live.
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
  const { password, playlists } = body;

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
  const path   = process.env.GITHUB_PATH || "playlists.json";
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: "GitHub-Env-Vars fehlen (GITHUB_TOKEN/OWNER/REPO)" });
  }

  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const gh = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "temple-publish",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // aktuellen SHA holen (für Update)
    let sha;
    const cur = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers: gh });
    if (cur.status === 200) {
      const j = await cur.json();
      sha = j.sha;
    } else if (cur.status !== 404) {
      const t = await cur.text();
      return res.status(502).json({ error: "GitHub GET fehlgeschlagen", detail: t.slice(0, 300) });
    }

    // neue Datei schreiben
    const content = JSON.stringify(playlists, null, 2) + "\n";
    const put = await fetch(api, {
      method: "PUT",
      headers: { ...gh, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `temple: update library (${(playlists.genres || []).reduce((n, g) => n + (g.tracks ? g.tracks.length : 0), 0)} tracks)`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!put.ok) {
      const t = await put.text();
      return res.status(502).json({ error: "GitHub PUT fehlgeschlagen", detail: t.slice(0, 300) });
    }
    const out = await put.json();
    return res.status(200).json({ ok: true, commit: out.commit && out.commit.sha });
  } catch (e) {
    return res.status(500).json({ error: "Serverfehler", detail: String(e).slice(0, 300) });
  }
}
