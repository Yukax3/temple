// Vercel Serverless Function — GET /api/stream?id=<soundcloud_track_id>
// Löst eine SoundCloud-Track-ID in eine direkte, im <audio> abspielbare Stream-URL auf.
//
// Wozu: Im SoundCloud-Widget (iframe) pausiert iOS die Wiedergabe, sobald der
// Browser in den Hintergrund geht / der Bildschirm gesperrt wird. Ein NATIVES
// <audio>-Element, das eine direkte Stream-URL abspielt, läuft dagegen im
// Hintergrund + auf dem Lock-Screen weiter (mit MediaSession). Dieser Endpoint
// liefert genau diese URL.
//
// Optional Env-Var:
//   SC_CLIENT_ID — fester SoundCloud client_id. Fehlt er, wird er gescrapet
//                  (und im warmen Funktions-Cache gehalten; bei 401 neu geholt).
//
// Hinweis (ehrlich): SoundCloud erlaubt das offiziell nicht. Der client_id kann
// gesperrt werden — dann scrapet der Endpoint automatisch einen neuen. "Go+"-
// Premium-Tracks liefern keine Transcodings -> Fallback aufs Widget im Frontend.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
let CID = process.env.SC_CLIENT_ID || null;   // warmer Cache über Invocations hinweg

async function scrapeClientId(){
  const page = await (await fetch("https://soundcloud.com/pxrecordz/sets/r4v3", { headers:{ "User-Agent":UA } })).text();
  const scripts = [...page.matchAll(/<script[^>]+src="(https:\/\/[^"]+sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m=>m[1]).reverse();
  for (const u of scripts){
    try{
      const js = await (await fetch(u, { headers:{ "User-Agent":UA } })).text();
      const m = js.match(/client_id\s*[:=]\s*"([0-9a-zA-Z]{20,})"/);
      if (m) return m[1];
    }catch(_){}
  }
  return null;
}
async function clientId(force){
  if (CID && !force) return CID;
  CID = await scrapeClientId();
  return CID;
}

async function resolve(id, cid){
  const meta = await fetch(`https://api-v2.soundcloud.com/tracks/${id}?client_id=${cid}`, { headers:{ "User-Agent":UA } });
  if (meta.status === 401) return { retry:true };
  if (!meta.ok) return { error:`track ${meta.status}` };
  const j = await meta.json();
  const trans = ((j.media || {}).transcodings) || [];
  if (!trans.length) return { error:"keine Transcodings (Go+/geschützt?)" };
  // progressive (MP3, überall abspielbar) bevorzugen, sonst HLS (iOS spielt .m3u8 nativ)
  const pick = trans.find(t=>t.format && t.format.protocol === "progressive")
            || trans.find(t=>t.format && t.format.protocol === "hls")
            || trans[0];
  const sr = await fetch(`${pick.url}${pick.url.includes("?") ? "&" : "?"}client_id=${cid}`, { headers:{ "User-Agent":UA } });
  if (sr.status === 401) return { retry:true };
  if (!sr.ok) return { error:`stream ${sr.status}` };
  const sj = await sr.json();
  if (!sj.url) return { error:"keine Stream-URL" };
  return { url: sj.url, protocol: pick.format.protocol, mime: (pick.format.mime_type || ""), title: j.title || "", duration: j.duration || 0 };
}

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET"){ res.setHeader("Allow","GET"); return res.status(405).json({ error:"Method not allowed" }); }

  const id = (req.query.id || "").toString().trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ error:"Parameter 'id' (numerische SoundCloud-Track-ID) fehlt" });

  try{
    let cid = await clientId(false);
    if (!cid) return res.status(502).json({ error:"kein client_id ermittelbar" });
    let out = await resolve(id, cid);
    if (out.retry){ cid = await clientId(true); out = await resolve(id, cid); }   // client_id abgelaufen -> neu scrapen + 1x retry
    if (out.retry) return res.status(502).json({ error:"401 (client_id gesperrt)" });
    if (out.error) return res.status(502).json(out);
    res.setHeader("Cache-Control", "public, max-age=600");   // Stream-URLs sind eine Weile gültig
    return res.status(200).json(out);
  }catch(e){
    return res.status(500).json({ error:String((e && e.message) || e) });
  }
}
