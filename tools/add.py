#!/usr/bin/env python3
"""
TEMPLE — Playlist hinzufügen.

Benutzung:
  python3 tools/add.py "<youtube-oder-soundcloud-url>" ["Genre / Subgenre"]

- YouTube / YouTube-Music Playlist (list=PL.../OLAK...)  -> tools/tracks_yt.json
- SoundCloud Set (soundcloud.com/.../sets/... | on.soundcloud.com/...) -> tools/tracks_sc.json
- Optionales Genre = Soft-Fallback: erkennbare Tracks werden trotzdem per Mapping einsortiert,
  der Rest landet im angegebenen Genre (statt "Unsortiert").

Danach automatisch:  python3 tools/build.py   (playlists.json + index.html neu)
"""
import sys, json, re, time, urllib.request, os

HDR={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
     "Cookie":"CONSENT=YES+1; SOCS=CAI","Accept-Language":"en-US,en;q=0.9"}
VID=re.compile(r'^[A-Za-z0-9_-]{11}$')
HERE=os.path.dirname(os.path.abspath(__file__))

def raw(u,data=None):
    h=dict(HDR)
    if data is not None: h["Content-Type"]="application/json"; data=json.dumps(data).encode()
    for a in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(u,data=data,headers=h),timeout=25).read().decode("utf-8","replace")
        except urllib.error.HTTPError as e:
            if e.code==429 and a<4: time.sleep(8*(a+1)); continue
            raise
def post(u,b): return json.loads(raw(u,b))

# ---------- YouTube (InnerTube browse, robust) ----------
def yt_ctx():
    h0=raw("https://www.youtube.com/playlist?list=PLtzJZlVCPLhaxLhtpRzT-Fxxb_1HYJeET&hl=en")
    key=re.search(r'"INNERTUBE_API_KEY":"([^"]+)"',h0).group(1)
    cver=(re.search(r'"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"',h0) or re.search(r'"clientVersion":"([^"]+)"',h0)).group(1)
    return key, {"client":{"clientName":"WEB","clientVersion":cver,"hl":"en","gl":"US"}}
def _lw(n,out,seen):
    if isinstance(n,dict):
        lv=n.get("lockupViewModel")
        if isinstance(lv,dict) and VID.match(lv.get("contentId","") or ""):
            cid=lv["contentId"]; md=(lv.get("metadata") or {}).get("lockupMetadataViewModel") or {}
            t=md.get("title") or {}; title=t.get("content","") if isinstance(t,dict) else ""; au=""
            for row in ((md.get("metadata") or {}).get("contentMetadataViewModel") or {}).get("metadataRows") or []:
                for part in (row.get("metadataParts") or []):
                    x=(part.get("text") or {}).get("content","")
                    if x: au=x; break
                if au: break
            if cid not in seen and title: seen.add(cid); out.append({"id":cid,"title":title,"author":au})
        for v in n.values(): _lw(v,out,seen)
    elif isinstance(n,list):
        for v in n: _lw(v,out,seen)
def _tok(n):
    if isinstance(n,dict):
        cc=n.get("continuationCommand")
        if isinstance(cc,dict) and cc.get("token"): return cc["token"]
        for v in n.values():
            r=_tok(v)
            if r: return r
    elif isinstance(n,list):
        for v in n:
            r=_tok(v)
            if r: return r
def scrape_yt(listid):
    key,ctx=yt_ctx(); out=[]; seen=set()
    r=post(f"https://www.youtube.com/youtubei/v1/browse?key={key}",{"context":ctx,"browseId":"VL"+listid})
    _lw(r,out,seen); t=_tok(r); pg=0
    while t and len(out)<5000 and pg<120:
        pg+=1; b=len(out); time.sleep(0.5)
        r=post(f"https://www.youtube.com/youtubei/v1/browse?key={key}",{"context":ctx,"continuation":t})
        _lw(r,out,seen); t=_tok(r)
        if len(out)==b: break
    return out

# ---------- SoundCloud ----------
def sc_client_id():
    _,h=_get("https://soundcloud.com/pxrecordz/sets/r4v3")
    for sj in re.findall(r'<script[^>]+src="(https://[^"]+sndcdn\.com/assets/[^"]+\.js)"',h)[::-1]:
        try:
            m=re.search(r'client_id\s*[:=]\s*"([0-9a-zA-Z]{20,})"',_get(sj)[1])
            if m: return m.group(1)
        except: pass
def _get(u):
    r=urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=25); return r.geturl(), r.read().decode("utf-8","replace")
def scrape_sc(url):
    final,html=_get(url)
    hy=json.loads(re.search(r'window\.__sc_hydration\s*=\s*(\[.*?\]);',html,re.S).group(1))
    pl=[d for d in hy if d.get("hydratable")=="playlist"]
    cid=sc_client_id(); out=[]
    if pl:
        ids=[t["id"] for t in pl[0]["data"].get("tracks",[])]
        for i in range(0,len(ids),50):
            for t in post_get(f"https://api-v2.soundcloud.com/tracks?ids={','.join(map(str,ids[i:i+50]))}&client_id={cid}"):
                out.append({"id":str(t["id"]),"source":"soundcloud","kind":"track","url":t.get("permalink_url",""),
                            "title":t.get("title",""),"artist":(t.get("user") or {}).get("username","")})
            time.sleep(0.2)
    return out
def post_get(u): return json.loads(_get(u)[1])

def main():
    if len(sys.argv)<2: print(__doc__); sys.exit(1)
    url=sys.argv[1]; genre=sys.argv[2] if len(sys.argv)>2 else None
    is_sc="soundcloud.com" in url
    if is_sc:
        path=os.path.join(HERE,"tracks_sc.json"); tracks=scrape_sc(url)
        for t in tracks:
            if genre: t["set_genre"]=genre
    else:
        m=re.search(r'[?&]list=([A-Za-z0-9_-]+)',url) or re.search(r'^([A-Za-z0-9_-]+)$',url)
        if not m: print("Keine list-ID gefunden."); sys.exit(1)
        path=os.path.join(HERE,"tracks_yt.json"); tracks=scrape_yt(m.group(1))
        for t in tracks:
            if genre: t["fallback_genre"]=genre
    ex=json.load(open(path)); have={x["id"] for x in ex}
    new=[t for t in tracks if t["id"] not in have]; ex+=new
    json.dump(ex,open(path,"w"),ensure_ascii=False,indent=1)
    print(f"{'SoundCloud' if is_sc else 'YouTube'} | gescraped {len(tracks)}, neu {len(new)} | Genre-Fallback: {genre or '—'}")
    # build
    os.system(f"cd {os.path.dirname(HERE)} && python3 tools/build.py >/dev/null 2>&1 && echo '  -> playlists.json + index.html neu gebaut'")

if __name__=="__main__": main()
