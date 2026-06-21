import re
import json, unicodedata
from collections import OrderedDict
def norm(s):
    s=unicodedata.normalize('NFD',(s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c)!='Mn')

# Reihenfolge = Priorität. Erster Treffer gewinnt. Pattern = normalisierter Substring in "titel + autor".
MAP=[
("tame impala","Psychedelic Rock"),("pink floyd","Psychedelic Rock"),("liquify","Psychedelic Rock"),("sleeping pandora","Psychedelic Rock"),("dryante","Mittelalter / Neofolk"),("macky gee","Drum & Bass"),("corntekk","Freetekno / Tekno"),
("postrock","Rock / Classic"),("post-rock","Rock / Classic"),("lorne balfe","Game / OST"),("book of life","Hip-Hop"),("give me the money","Roots Reggae"),("martin campbell","Roots Reggae"),("keelo","Forest / Darkpsy"),
("hi-tech","Hi-Tech"),("hitech","Hi-Tech"),("hi tech","Hi-Tech"),("henrique camacho","Hi-Tech"),("psykart","Hi-Tech"),("maramba","Hi-Tech"),("marambá","Hi-Tech"),("retro future trance","Hi-Tech"),("fake drop 180bpm","Hi-Tech"),("200 bpm","Hi-Tech"),("progressive psytrance","Progressive Psy"),("progressive psy","Progressive Psy"),("prog psy","Progressive Psy"),("progressive trance","Progressive Psy"),("progressive mix","Progressive Psy"),("full-on","Goa / Psytrance"),("fullon","Goa / Psytrance"),("full on","Goa / Psytrance"),("forest psy","Forest / Darkpsy"),("forestpsy","Forest / Darkpsy"),("darkpsy","Forest / Darkpsy"),("dark psy","Forest / Darkpsy"),("hi-tech forest","Forest / Darkpsy"),("psycore","Forest / Darkpsy"),

("nuages","Ambient / IDM"),("n u a g e s","Ambient / IDM"),("kachu","Freetekno / Tekno"),("kachu2k","Freetekno / Tekno"),("city am fenster","Volksmusik / Schlager"),("am fenster","Volksmusik / Schlager"),("drum and bass","Drum & Bass"),("drum & bass","Drum & Bass"),("dnb","Drum & Bass"),("neurofunk","Drum & Bass"),("liquid dnb","Drum & Bass"),("jump up","Drum & Bass"),("d&b","Drum & Bass"),
("driftwood holly","Akustik / Folk"),("the comet is coming","Downtempo / Trip-Hop"),("comet is coming","Downtempo / Trip-Hop"),("forest swords","Downtempo / Trip-Hop"),("neelix","Goa / Psytrance"),("unlogix","Goa / Psytrance"),("daso","Techno / House"),("hotel pools","Pop / Synthwave"),("oddling","Pop / Synthwave"),("ivoxygen","Pop / Synthwave"),("mokalamity","Reggae / Dub"),("electronic system","Pop / Synthwave"),
("john summit","Techno / House"),("fred again","Techno / House"),("fatboy slim","Pop / Synthwave"),("oliver tree","Indie / Dream-Pop"),("goddard.","Techno / House"),
("high contrast","Liquid DnB"),("dj marky","Liquid DnB"),("london elektricity","Liquid DnB"),("netsky","Liquid DnB"),("etherwood","Liquid DnB"),("keeno","Liquid DnB"),("lenzman","Liquid DnB"),("bcee","Liquid DnB"),("hybrid minds","Liquid DnB"),("fred v","Liquid DnB"),("grafix","Liquid DnB"),("maduk","Liquid DnB"),("feint","Liquid DnB"),("koven","Liquid DnB"),("technimatic","Liquid DnB"),("whiney","Liquid DnB"),("blu mar ten","Liquid DnB"),("hybrid theory","Liquid DnB"),("liquid dnb","Liquid DnB"),("liquid funk","Liquid DnB"),
("noisia","Neurofunk"),("phace","Neurofunk"),("mefjus","Neurofunk"),("black sun empire","Neurofunk"),("annix","Neurofunk"),("billain","Neurofunk"),("current value","Neurofunk"),("maztek","Neurofunk"),("the upbeats","Neurofunk"),("prolix","Neurofunk"),("neurofunk","Neurofunk"),("agressor bunx","Neurofunk"),
("macky gee","Jump Up"),("skepsis","Jump Up"),("kanine","Jump Up"),("hedex","Jump Up"),("dj hazard","Jump Up"),("original sin","Jump Up"),("benny l","Jump Up"),("sub zero","Jump Up"),("dutta","Jump Up"),("jump up","Jump Up"),
("windhand","Stoner / Doom"),("meiko","Chill / Lounge"),("leave the lights on","Chill / Lounge"),("omer balik","Chill / Lounge"),("omer balık","Chill / Lounge"),("coffee blues","Chill / Lounge"),("bon iver","Chill / Lounge"),
("daniel norgren","Akustik / Folk"),("hermanos gutierrez","Akustik / Folk"),("hermanos gutiérrez","Akustik / Folk"),("estas tonne","Akustik / Folk"),("estás tonné","Akustik / Folk"),("jose gonzalez","Akustik / Folk"),("josé gonzález","Akustik / Folk"),("ben howard","Akustik / Folk"),("keaton henson","Akustik / Folk"),
("gnarls barkley","Indie / Dream-Pop"),("adam vandal","Freetekno / Tekno"),("hot","Freetekno / Tekno") if False else ("adam vandal","Freetekno / Tekno"),
("grasgeflüster","Reggae / Dub"),("grasgefluster","Reggae / Dub"),
("trip hazard","Psychedelic Rock"),("game of thrones","Game / OST"),
# --- Override-Phrasen zuerst ---
("psychedelic rock","Psychedelic Rock"),("psych rock","Psychedelic Rock"),("space rock","Psychedelic Rock"),
("dungeon synth","Mittelalter / Neofolk"),("psychedelic kung fu","Psychedelic Rock"),
("psychill","Psybient / Psychill"),("psybient","Psybient / Psychill"),("psydub","Psybient / Psychill"),
("hi-tech","Goa / Psytrance"),("hitech","Goa / Psytrance"),("hi tech","Goa / Psytrance"),
("psytrance","Goa / Psytrance"),("psy-trance","Goa / Psytrance"),("[goa]","Goa / Psytrance"),("darkpsy","Goa / Psytrance"),("forest psy","Goa / Psytrance"),("fullon","Goa / Psytrance"),
("acidcore","Freetekno / Tekno"),("[tekno]","Freetekno / Tekno"),("free tekno","Freetekno / Tekno"),("freetekno","Freetekno / Tekno"),("mental tekno","Freetekno / Tekno"),("hardtek","Freetekno / Tekno"),("tribecore","Freetekno / Tekno"),("(tekno","Freetekno / Tekno"),("tekkno","Freetekno / Tekno"),
("gabber","Hardcore / Gabber"),("gabbermukke","Hardcore / Gabber"),
("schranz","Techno / House"),
# --- Roots Reggae (deep roots / vintage vinyl) ---
*[(p,"Roots Reggae") for p in ["israel vibration","burning spear","the congos"," congos","the gladiators","gladiators","twinkle brothers","gregory isaacs","peter tosh","bob marley"," marley","pablo moses","the viceroys","viceroys","yabby you","don carlos","jacob miller","sam carty","vivian jones","horace martin","roman stewart","carlene davis","desi roots","everton dacres","freddie mckay","the ovations","toney barrett","tony brutus","tony ford","hortense ellis","jennifer lara","bro yahya","mikey dread","ini kamoze","culture - topic","mystic revelation","twelve tribes of israel","jah solid rock","deep roots","roots reggae"]],
# --- Reggae / Dub (sehr distinktiv) ---
*[(p,"Reggae / Dub") for p in ["israel vibration","gladiators","bob marley","peter tosh","gregory isaacs","josey wales","the congos","burning spear","pablo moses","yabby you","viceroys","sizzla","protoje","julian marley","alborosie","stick figure","ub40","inner circle","musical youth","eddy grant","groundation","twinkle brothers","don carlos","barrington levy","ini kamoze","martin jondo","raggabund","taiwan mc","mystic revelation","lodeva sound","jah guidance","jamaican roots","mystic realness","reggaeville","shaolin vibes","bionic dub","duba dub","crucial brew","seven beats music","jacob miller","vivian jones","horace martin","jah sun","marlon asher","reggae professor","zaidinreggae","roman stewart","carlene davis","desi roots","everton dacres","freddie mckay","twelve tribes","toney barrett","tony brutus","tony ford","the ovations","hortense ellis","jennifer lara","bro yahya","midnight riders","mikey dread","dub garden","dreadlights","stereo ferment","space dub","reggae","roots reggae"," dub","ganja","rastaman"," jah ","chalice","herbal roots","weed bun","calypso rose","manu chao","mano negra","groundation","culture - topic","yellowman","sashamon","zodiakk","gangsta","conscious roots","ragga","skank","alborosie","protoje","stick figure","peter tosh","bob marley","julian marley","spud","the congos","ovations","ini kamoze"]],
# --- Satire / Liedermacher ---
*[(p,"Satire / Liedermacher") for p in ["soellner","sollner","gotz widmann","widmann","rainald grebe","joint venture","hannes wader","funny van dannen","schnipo schranke","schnipo","rakede","walter westrupp","pfui&deifel"]],
# --- Stoner / Doom ---
*[(p,"Stoner / Doom") for p in ["turbo moses","stoned jesus","naxatras","king buffalo","electric wizard","black sabbath","kyuss","dozer","truckfighters","stoned cobra","earthless","spiral caravan","the myrrors","sun dial","unida","daevar","stoner","doom","desert cruiser","fuzz","sakaros","stoned meadow","rubber zebra","stoned"]],
# --- Goa / Psytrance ---
*[(p,"Goa / Psytrance") for p in ["psychedelicious","aardvarkk","altar records","blacklite","alpha portal","burn in noise","e-mantra","e mantra","indira paganotto","henrique camacho","oroboro","psykart","psykovsky","psy'koz","psykoz","marambá","maramba","retro future trance","s.o.m.a.","inner coma","brainstalker","depuratus","robin draper","konebu","virtuanoise","tabura","little whale","spirits of oracle","mantismash","insectoid","charis ma","pfui","suduaya","dungeon master","blether","insane creatures","zenkai","zzbing","keelo","mystic55","oxyflux","profound","thelios","l55","fele","trance is gonna","goa","forest","retro future","moldetek","matmatek","frenktek","gravagerz","s h a d o w","supersonics","release - topic","bioterranean","acid face of the moon","s.o.m.a"]],
# --- Freetekno / Tekno ---
*[(p,"Freetekno / Tekno") for p in ["acidpach","baga tek","bagă tek","nawatt","servietek","kresikore","p4kid3rm","ltt ","weichentechnikk","mecadioxid","sastouki","floflox","retour d'acid","retour d","anfetamina","funk tribu","part time killer"]],
# --- Hardcore / Gabber ---
*[(p,"Hardcore / Gabber") for p in ["kahlkopf","hardcore","frenchcore","terror"]],
# --- Psybient / Psychill ---
*[(p,"Psybient / Psychill") for p in ["carbon based lifeforms","sync24","solar fields","dreamstate logic","kalya scintilla","kiphi","alkor","avilente","fourth dimension","organic patterns","mood shifter","man of no ego","insectoid intelligence","logical elements","siebzehn","mythospheric","ethereal mindwaves","sleeping pandora","liquify","the psychedelic muse","cosmic soundwaves","mescalito","l@g","chillgressive","mantra for hybrids"]],
# --- Ambient / IDM ---
*[(p,"Ambient / IDM") for p in ["loscil","steve hauschildt","soundscape hub","takeo suzuki","ambient buddhism","vpg ","boards of canada","aphex twin","autechre","grouper","steve brenner","kenichiro isoda","dan caine","432hz meditation","meditation","relax your mind","peaceful solitude","sleep mix","ambient","drone","macroblank","vapor memory","home : odyssey","loscil"]],
# --- Downtempo / Trip-Hop ---
*[(p,"Downtempo / Trip-Hop") for p in ["bonobo","quantic","gramatik","hugo kant","skinshape","telepopmusik","caribou","jamie xx","gaslamp killer","two feet","lorn","tor -","neroche","felio","downtempo","trip-hop","trip hop","hippie sabotage","flume","disclosure","moby","nicola cruz","oldtwig","mose","boombap","boom bap","gaslamp","tipper","jungletango"]],
# --- Techno / House ---
*[(p,"Techno / House") for p in ["oliver koletzki","worakls","nils hoffmann","david keller","sascha funke","ten walls","pachanga boys","monument","mnmt","stil vor talent","klangkarussell","rrose","ishome","nu & jo ke","mika heggemann","brutalismus 3000","hvob","robin schulz","jaques raupe","daso","pachanga","koletzki","ten walls","techno","original mix"]],
# --- Mittelalter / Neofolk ---
*[(p,"Mittelalter / Neofolk") for p in ["omnia","gealdyr","ougenweide","bohemian bards","musica medievale","minnesang","troubadour","medieval","mittelalter","spielmann","dudelsack","ungern sternberg","zwirbert","spellsword","osi and the jupiter","aindulmedir","fogweaver","neofolk","witan","gealdýr"]],
# --- Hip-Hop ---
*[(p,"Hip-Hop") for p in ["mf doom","wu-tang","wu tang","gang starr","souls of mischief","four owls","meek mill","mc hammer","skyfall beats","phoniks","highfocus","gravediggaz","rza","jeru","gang starr"]],
# --- Indie / Dream-Pop ---
*[(p,"Indie / Dream-Pop") for p in ["lord huron","dope lemon","angus stone","mild orange","far caspian","flipturn","moon monsoon","rum jungle","mansionair","still corners","tamaryn","beach house","broken bells","phantogram","electric guest","ry x","jose gonzalez","jose gonzález","woodkid","lola marsh","jonathan bree","human tetris","motorama","savages","chelsea wolfe","daughter","velvet meadow","maha sohona","willis","kowloon","low hum","delicate steve","heartless bastards","rattlesnake milk","blue foundation","duster","skinshape","klanglos","still corners","tame impala","babe rainbow"]],
# --- Pop / Synthwave ---
*[(p,"Pop / Synthwave") for p in ["madonna","laura branigan","bronski beat","new order","wonderful life","robert miles","laid back","one-t","akon","ten walls","sting","the police","robin schulz","klangkarussell"]],
# --- Rock / Classic ---
*[(p,"Rock / Classic") for p in ["red hot chili peppers","john frusciante","linkin park","tool","scorpions","toto","manfred mann","the verve"," sting","buckethead","zakk wylde","tom petty","neil young","kings of leon","blackfoot","puhdys","moody blues","the hollies","alan parsons","terry reid","grönemeyer","gronemeyer","ton steine scherben","cochise","heart -","america -","red red wine","pink floyd","grateful dead","linkin park","metal","rock"]],
# --- Folktronica / Shamanic ---
*[(p,"Folktronica / Shamanic") for p in ["shivelight","numa","samaya","poranguí","porangui","liquid bloom","hombre medicina","turu dorom","turú dorōm","nawa daime","náwa daime","david leyton","sam garrett","nessi gomes","janax pacha","rodrigo gallardo","islandman","tissilawen","praful","millemon","arc de soleil","shamanic","medicina","ayahuasca","ceremonia","folktronica","organic downtempo","multi culti","naturritu","n λ t u r r i t u","mirage voxe","ape chimba","biomigrant","kura","mantra","kirtan","os tincoas","os tincoãs","shaman","sagrada","cosmica","encantos"]],
# === Nachsortierung der Unsortierten ===
*[(p,"Healing / Meditation") for p in ["maneesh de moor","anugama","liquid mind","yulia klenova","neowake","the sound healers","zenscape","gerhard & einat","ajeet","ram dass","solfeggio","852 hz","528 hz","963 hz","741 hz","111hz","136.1hz","90hz","metatron","savasana","natarajasana","sound healing","healing song","healing earth","healing ocean","relaxation ocean","liquid mind","savvas kalt"]],
*[(p,"Organic / Ethno") for p in ["el buho","el búho","joaquin cornejo","joaquín cornejo","seba campos"," yuri","aguila real","águila real","lagartijeando","desert dwellers","danit","mahumen","lido pimienta","pablo rozas","nibana","aware","awarë","deya dova","geometrae","ayla schafer","jordi cantos","yaima","mogli","xavier rudd","soma frequency","jiboia branca","gingai","gingaí","matanza","ibu selva","ignacio maria gomez","ballake sissoko","xuqutopi","savaborsa","resueno","resueño","mollie mendoza","alex serra","al fredo","canal dany matos","byron metcalf","namaste","jaya shiva","mercedes sosa","spirit bird","didgeridoo","dojo rich","wakan tanka","kauyumari","madreselva","floresta","pachamama","rapé","icaro","sebananda","be svendsen","cercle","ignacio maria","helico","gracias madre","taita inti","força do rapé","força do rape","mapping the cosmos"]],
*[(p,"Ambient / IDM") for p in ["brian eno","fripp & eno","fripp and eno","steve roach","lustmord","biosphere","nala sinephro","jon hopkins","ocoeur","phill niblock","astronaut ape","stretched","myst - topic","aram bajakian","sounds of snow","deeb - topic","77 million paintings","equatorial stars","substrata","ziqooh","adam dodson"]],
*[(p,"Goa / Psytrance") for p in ["crone - topic","cursed souls","bao kao","raik","aseckas"]],
*[(p,"Stoner / Doom") for p in ["witch - seer"]],
*[(p,"Psychedelic Rock") for p in ["lemon fog","khruangbin"]],
*[(p,"Mittelalter / Neofolk") for p in ["spellsw","years of silence","ruumisto"," tir ","scholastum"]],
*[(p,"Techno / House") for p in ["stephan busse","torsten kanzler","bretthit","brett hit"]],
*[(p,"Downtempo / Trip-Hop") for p in ["le wanski","vanilla -","mischluft","j.pool","nala sinephro"]],
*[(p,"Indie / Dream-Pop") for p in ["kevin morby","michelle gurevich","sault","the folks","finnegan tui","mellow movez","charlie hunter","celine dessberg","céline dessberg","analog sunshine","southstar","tonic walter","still corners","kowloon","björn andersson","fluidage"]],
*[(p,"Rock / Classic") for p in ["men at work","chris isaak","neil young","cortez the killer","horse with no name","losing my religion","r.e.m","blur - song 2","rondo veneziano","rondò veneziano","witch","puhdys"]],
*[(p,"Hip-Hop") for p in ["greeen","upstruct","mc bomber"]],
*[(p,"Satire / Liedermacher") for p in ["simon & jan","simonundjan","simon und jan","schnipo","revolte springen","scheissen auf karriere"]],
# === Nachsortierung Runde 2 ===
*[(p,"Techno / House") for p in ["paul kalkbrenner","kalkbrenner","muschi muschi","dbbd","gigi d'agostino","gigi dagostino","ben bohmer","ben böhmer","luttrell","isaac chambers","aaron smith - dancin"]],
*[(p,"Punk") for p in ["trabireiter","deutschpunk","schweine + benzin","schweine und benzin"]],
*[(p,"Hip-Hop") for p in ["2pac","50 cent","dr. dre","dr dre","ice cube","kendrick lamar","j. cole","jay-z","jaÿ-z","kid cudi","lil wayne","lil uzi vert","logic -","migos","mask off","notorious b.i.g","outkast","schoolboy q","sheck wes","travis scott","tyler, the creator","tone loc","rob stone","chill bill","mo bamba","gnarls barkley","earfquake","sicko mode","ms. jackson","big poppa","day 'n' nite","indica badu","no role modelz"]],
*[(p,"Game / OST") for p in ["poké & chill","poke & chill","gamechops","dryante","baldur's gate","baldurs gate","skyrim","morrowind","oblivion","stronghold","heroes of might","divinity: original sin","game of thrones","mandalorian","tenet official","ennio morricone","greatest western","imaginary western","oscars theme","star wars","light of the seven","two mandolins","fluch der karibik","greg hulme","game of themes","watertower"]],
*[(p,"Mittelalter / Neofolk") for p in ["tagelharpa","a tergo lupi","dark folk","heilung","wardruna","tabernis","nordstille","vigundr","vígundr","frosty","intihik","elthin","frigg","otava yo","filip holm","faun","federkleid","ebanisteria","helvegen","herr mannelig","norupo","loddfafnir","ragnarok","deloraine","lyod","backbone of the urals","an dro","douce dame jolie","veraldar","craban ur dru","samovar","korobushka","der voghormia"]],
*[(p,"Stoner / Doom") for p in ["black rainbows","stone rebel","stonus","skelephant","mars red sky","colour haze","cosmic desert","i am the desert","deep purple","van halen"]],
*[(p,"Indie / Dream-Pop") for p in ["mazzy star","alt-j","m83","empire of the sun","capital cities","phantom planet","djo -","djo music","lana del rey","keaton henson","low - lullaby","dillon","ghostly kisses","palace -","david kushner","wolf larsen","beth hart","daniel norgren","allah-las","portishead","yuuf","zackery","foudeqush","mateus asato","hermanos gutierrez","hermanos gutiérrez","nouvelle vague","ben howard","mansionair","creed -"]],
*[(p,"Ambient / IDM") for p in ["tangerine dream","vangelis","lisa gerrard","ludovico einaudi","tony anderson","balmorhea","windows96","aural palaces","alexander nakarada","cyberlife","symphocat","long whale","sonna -","steven lynn","estas tonne","estás tonné","tchaikovsky","nutcracker"]],
*[(p,"Healing / Meditation") for p in ["enya","enigma","loreena mckennitt","alexia chellun","oud","zen garden","nao sogabe","meditative"]],
*[(p,"Rock / Classic") for p in ["genesis -","rammstein","kino","группа крови","ken hensley","phil collins","deep purple official","udo lindenberg","song des tages","stoll schieb den blues"]],
*[(p,"Pop / Synthwave") for p in ["depeche mode","bee gees","beegees","empire of the","gigi d","capital cities"]],
*[(p,"Volksmusik / Schlager") for p in ["neuneralm","d'neuneralm","herbert roth","rennsteiglied","zottlmusi","goiserer","udo jurgens","udo jürgens","griechischer wein","isi glück","isi gluck","heimatländer","heimatlander","viergesang","weihnacht","trio wahnsinn"]],
*[(p,"Satire / Liedermacher") for p in ["bettina wegner","witthuser","witthüser","westrupp","b-migos","iltis","feuerwehr statt"]],
*[(p,"Organic / Ethno") for p in ["anthar kharana","inti-illimani","rising appalachia","la piragua","umoja","canto ancestral","bedouins","jonna jinton","anawak","espiritu del viento","espíritu del viento","shaolin afronauts","yin yin","yīn yīn"," angela viana","ângela viana"]],


]

vids=json.load(open("tools/tracks_yt.json"))
GENRE_ORDER=["Goa / Psytrance","Hi-Tech","Progressive Psy","Forest / Darkpsy","Psybient / Psychill","Ambient / IDM","Healing / Meditation","Downtempo / Trip-Hop","Chill / Lounge","Techno / House","Drum & Bass","Liquid DnB","Neurofunk","Jump Up","Freetekno / Tekno","Hardcore / Gabber","Roots Reggae","Reggae / Dub","Stoner / Doom","Psychedelic Rock","Indie / Dream-Pop","Akustik / Folk","Rock / Classic","Punk","Pop / Synthwave","Hip-Hop","Folktronica / Shamanic","Organic / Ethno","Mittelalter / Neofolk","Satire / Liedermacher","Volksmusik / Schlager","Game / OST","Unsortiert"]
def classify(t,a):
    h=norm(t+" "+a)
    htok=" "+re.sub(r"[^a-z0-9]+"," ",h).strip()+" "
    for pat,g in MAP:
        np=norm(pat)
        if (" " in np) or len(np)>=7:
            if np in h: return g
        else:
            if (" "+re.sub(r"[^a-z0-9]+"," ",np).strip()+" ") in htok: return g
    return "Unsortiert"

groups=OrderedDict((g,[]) for g in GENRE_ORDER)
for v in vids:
    g=v.get("force_genre")
    if not g:
        g=classify(v["title"],v.get("author",""))
        if g=="Unsortiert" and v.get("fallback_genre"): g=v["fallback_genre"]
    groups.setdefault(g,[]).append({"id":v["id"],"source":"youtube","kind":"video","title":v["title"],"artist":v.get("author",""),"dur":v.get("dur",0),"added":"2026-06-17T00:00:00Z"})
import os, json as _j
if os.path.exists("tools/tracks_sc.json"):
    for _t in _j.load(open("tools/tracks_sc.json")):
        _g=classify(_t["title"],_t.get("artist",""))
        if _g=="Unsortiert": _g=_t.get("set_genre","Unsortiert")
        groups.setdefault(_g,[]).append({"id":_t["id"],"source":"soundcloud","kind":"track","url":_t.get("url",""),"title":_t["title"],"artist":_t["artist"],"dur":_t.get("dur",0),"added":"2026-06-17T00:00:00Z"})
# Manifest (winzig, sofort) + Per-Genre-Dateien (lazy/progressiv geladen)
import os
os.makedirs("data",exist_ok=True)
def _slug(s): return re.sub(r'[^a-z0-9]+','-',norm(s)).strip('-') or 'x'
man={"version":2,"manifest":True,"updated":"2026-06-18T00:00:00Z","genres":[]}
_tot=0; _hsec=0
for g,t in groups.items():
    dk=sum(x.get("dur",0) for x in t); dc=sum(1 for x in t if x.get("dur"))
    man["genres"].append({"name":g,"count":len(t),"durKnown":dk,"durCount":dc})
    _tot+=len(t); _hsec+=dk+(len(t)-dc)*300
    json.dump({"name":g,"tracks":t},open(f"data/{_slug(g)}.json","w"),ensure_ascii=False,separators=(",",":"))
man["total"]=_tot; man["hsec"]=_hsec
json.dump(man,open("playlists.json","w"),ensure_ascii=False,separators=(",",":"))
print("total:",_tot,"| manifest + per-genre data/ geschrieben")
for g,t in groups.items(): print(f"  {len(t):>3}  {g}")


# === index.html: GENRE_RULES + SEED_GENRES neu einspielen ===
import re as _re
def _js(x): return '"'+x.replace("\\","\\\\").replace('"','\\"')+'"'
_L=["const GENRE_RULES = ["]; _b="  "
for _p,_g in MAP:
    _it="["+_js(_p)+","+_js(_g)+"], "
    if len(_b)+len(_it)>112: _L.append(_b.rstrip()); _b="  "
    _b+=_it
_L.append(_b.rstrip()); _L.append("];")
_h=open("index.html").read()
_h,_a=_re.subn(r'const SEED_GENRES = \[[^\]]*\];', ("const SEED_GENRES = ["+", ".join(_js(g) for g in GENRE_ORDER)+"];").replace("\\","\\\\"),_h,1)
_h,_c=_re.subn(r'const GENRE_RULES = \[[\s\S]*?\n\];', ("\n".join(_L)).replace("\\","\\\\"),_h,1)
assert _a==1 and _c==1, "reinject failed"
open("index.html","w").write(_h)
print("index.html: rules+seed reinjected")
