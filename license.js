// Vercel Serverless Function — POST /api/license   { "key": "XXXX-..." }
// Validiert einen Lemon-Squeezy-Lizenz-Key. Antwort: { ok:true } | { ok:false, error }
//
// Lemon Squeezy: One-time-Produkt mit "License keys" aktivieren -> jeder Kauf erzeugt
// automatisch einen Key. Dieser Endpoint prüft ihn gegen die öffentliche Validate-API
// (kein API-Key nötig). Optional auf DEINEN Store/Produkt einschränken via Env-Vars.
//
// Optionale Env-Vars (empfohlen, damit nur Keys AUS deinem Produkt zählen):
//   LS_STORE_ID    — deine Lemon-Squeezy Store-ID
//   LS_PRODUCT_ID  — die Produkt-ID des Pro-Produkts

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST"){ res.setHeader("Allow","POST"); return res.status(405).json({ error:"POST only" }); }

  let body = req.body;
  if (typeof body === "string"){ try{ body = JSON.parse(body); }catch(_){ body = {}; } }
  const key = ((body && body.key) || "").toString().trim();
  if (!key) return res.status(400).json({ ok:false, error:"key fehlt" });

  // Owner-/Test-Keys: serverseitig in Vercel setzen, niemals hart ins Repo schreiben.
  // Env-Var: TEMPLE_OWNER_KEYS="KEY1,KEY2"
  const ownerKeys = (process.env.TEMPLE_OWNER_KEYS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (ownerKeys.includes(key)) return res.status(200).json({ ok:true, owner:true });

  try{
    const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method:"POST",
      headers:{ "Accept":"application/json", "Content-Type":"application/x-www-form-urlencoded" },
      body: new URLSearchParams({ license_key: key })
    });
    const j = await r.json().catch(()=>({}));
    const lk = j.license_key || {};
    const valid = !!j.valid && (lk.status === "active" || lk.status === "inactive");
    if (!valid) return res.status(402).json({ ok:false, error: j.error || "Lizenz ungültig" });

    // optional: nur Keys aus DEINEM Store/Produkt akzeptieren
    const meta = j.meta || {};
    if (process.env.LS_STORE_ID   && String(meta.store_id)   !== String(process.env.LS_STORE_ID))   return res.status(403).json({ ok:false, error:"falscher Store" });
    if (process.env.LS_PRODUCT_ID && String(meta.product_id) !== String(process.env.LS_PRODUCT_ID)) return res.status(403).json({ ok:false, error:"falsches Produkt" });

    return res.status(200).json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:String((e && e.message) || e) });
  }
}
