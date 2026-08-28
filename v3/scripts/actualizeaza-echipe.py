# -*- coding: utf-8 -*-
"""Actualizează data/echipe.json: program, rezultate, formă și loturi pentru
echipele de fotbal (Liga 2) și handbal feminin (Liga Națională) ale CSM Slatina.

Surse:
- Flashscore (paginile de echipă au datele direct în HTML-ul servit, format feed:
  înregistrări «~», câmpuri «¬», cheie÷valoare) — meciuri + lotul de fotbal;
- lotul de handbal: date factuale (nume, numere, posturi) preluate din articolul
  Wikipedia „CSM Slatina (handbal feminin)", sezonul de referință 2024/25 —
  se actualizează manual în LOT_HANDBAL de mai jos când clubul anunță schimbări.

Rulare:  python scripts/actualizeaza-echipe.py
Poate fi pus într-un GitHub Action pe cron, împreună cu actualizeaza-meciuri.py.
"""
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ECHIPE = {
    "fotbal": {
        "id": "zRqy53ur",
        "competitie": "Liga 2",
        "baza": "https://www.flashscore.ro/echipa/csm-slatina/zRqy53ur/",
        "areLot": True,
    },
    "handbal": {
        "id": "ptT2ffej",
        "competitie": "Liga Națională (feminin)",
        "baza": "https://www.flashscore.ro/echipa/csm-slatina/ptT2ffej/",
        "areLot": False,
    },
}

# Lotul de handbal — date factuale după Wikipedia, „CSM Slatina (handbal feminin)",
# lotul 2024/25 (sursa originală: pagina oficială a clubului). De actualizat manual.
LOT_HANDBAL = [
    {"numar": 1,  "nume": "Bianca Cioponea",    "post": "Portar",          "nat": "România"},
    {"numar": 16, "nume": "Elena Nagy",         "post": "Portar",          "nat": "România"},
    {"numar": 58, "nume": "Merve Erbektaș",     "post": "Portar",          "nat": "Turcia"},
    {"numar": 72, "nume": "Jovana Micevska",    "post": "Portar",          "nat": "Macedonia de Nord"},
    {"numar": 7,  "nume": "Jovana Sazdovska",   "post": "Extremă stânga",  "nat": "Macedonia de Nord"},
    {"numar": 96, "nume": "Hermina Olaru",      "post": "Extremă stânga",  "nat": "România"},
    {"numar": 3,  "nume": "Adina Cace",         "post": "Extremă dreapta", "nat": "România"},
    {"numar": 94, "nume": "Cristina Boian",     "post": "Extremă dreapta", "nat": "România"},
    {"numar": 97, "nume": "Alina Mușat",        "post": "Extremă dreapta", "nat": "România"},
    {"numar": 9,  "nume": "Elena Fulgoi",       "post": "Pivot",           "nat": "România"},
    {"numar": 18, "nume": "Manuela Ninciu",     "post": "Pivot",           "nat": "România"},
    {"numar": 23, "nume": "Andreea Țîrle",      "post": "Pivot",           "nat": "România"},
    {"numar": 77, "nume": "Ivana Gakidova",     "post": "Pivot",           "nat": "Macedonia de Nord"},
    {"numar": 2,  "nume": "Narcisa Verde",      "post": "Coordonator",     "nat": "România"},
    {"numar": 6,  "nume": "Gabriela Istrate",   "post": "Coordonator",     "nat": "România"},
    {"numar": 13, "nume": "Ana Radović",        "post": "Coordonator",     "nat": "Muntenegru"},
    {"numar": 76, "nume": "Döne Gül Bozdoğan",  "post": "Coordonator",     "nat": "Turcia"},
    {"numar": 8,  "nume": "Andreea Bogdanovici","post": "Inter stânga",    "nat": "România"},
    {"numar": 10, "nume": "Sonia Vasiliu",      "post": "Inter stânga",    "nat": "România"},
    {"numar": 43, "nume": "Nada Ćorović",       "post": "Inter stânga",    "nat": "Muntenegru"},
    {"numar": 98, "nume": "Mara Matea",         "post": "Inter stânga",    "nat": "România"},
    {"numar": 11, "nume": "Valentina Lecu",     "post": "Inter dreapta",   "nat": "România"},
    {"numar": 27, "nume": "Sanja Premović",     "post": "Inter dreapta",   "nat": "Muntenegru"},
]

SEP_REC, SEP_CAMP, SEP_KV = "~", "¬", "÷"

# certificatele nu se pot valida pe această mașină (ceas/lanț) — citiri publice
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def descarca(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return r.read().decode("utf-8", "replace")


def campuri_din(rec):
    out = {}
    for camp in rec.split(SEP_CAMP):
        if SEP_KV in camp:
            k, _, v = camp.partition(SEP_KV)
            out[k] = v
    return out


def extrage_meciuri(html):
    """Toate meciurile din feed-ul inline; AB÷1 = programat, AB÷3 = încheiat."""
    meciuri, liga = {}, ""
    for rec in html.split(SEP_REC):
        c = campuri_din(rec)
        if "ZK" in c:
            liga = c["ZK"]
        if not (c.get("AA") and c.get("AD") and c.get("AE") and c.get("AF")):
            continue
        m = {
            "id": c["AA"],
            "timestamp": int(c["AD"]),
            "gazde": c["AE"],
            "oaspeti": c["AF"],
            "competitie": liga,
            "stare": c.get("AB", ""),
        }
        if c.get("AG") is not None and c.get("AH") is not None:
            m["scor"] = [int(c["AG"]), int(c["AH"])]
        meciuri[m["id"]] = m  # dedup (fiecare meci apare de două ori în pagină)
    return sorted(meciuri.values(), key=lambda x: x["timestamp"])


def rezumat_meci(m):
    """Formă compactă pentru site + litera de formă din perspectiva CSM."""
    acasa = m["gazde"].startswith("CSM Slatina")
    out = {
        "timestamp": m["timestamp"],
        "gazde": m["gazde"],
        "oaspeti": m["oaspeti"],
        "competitie": m["competitie"],
        "acasa": acasa,
    }
    if "scor" in m:
        out["scor"] = m["scor"]
        noi, ei = (m["scor"][0], m["scor"][1]) if acasa else (m["scor"][1], m["scor"][0])
        out["forma"] = "V" if noi > ei else ("E" if noi == ei else "Î")
    return out


def lot_fotbal(html):
    """Lotul din tabelul server-rendered: grupă, număr, nume, vârstă, naționalitate."""
    titluri = [(mm.start(), mm.group(1)) for mm in re.finditer(r'lineupTable__title[^>]*>([^<]+)<', html)]
    randuri = re.finditer(
        r'lineupTable__cell--jersey">\s*([0-9]*)\s*</div>.*?title="([^"]+)".*?'
        r'href="(/jucator/[^"]+)">\s*([^<]+?)\s*</a>.*?cell--age">([0-9]*)</div>',
        html, re.S,
    )
    lot, antrenor, vazuti = [], None, set()
    for r in randuri:
        grupa = ""
        for poz, titlu in titluri:
            if poz < r.start():
                grupa = titlu.strip()
        nume = r.group(4).strip()
        if nume in vazuti:
            continue  # pagina conține lotul de două ori
        vazuti.add(nume)
        if grupa == "Antrenor":
            antrenor = nume
            continue
        post = {"Portari": "Portar", "Fundași": "Fundaș", "Mijlocași": "Mijlocaș", "Atacanți": "Atacant"}.get(grupa, grupa)
        lot.append({
            "numar": int(r.group(1)) if r.group(1) else None,
            "nume": nume,
            "post": post,
            "varsta": int(r.group(5)) if r.group(5) else None,
            "nat": r.group(2).strip(),
            "url": "https://www.flashscore.ro" + r.group(3),
        })
    return lot, antrenor


def statistici_jucator(html):
    """Primul rând din tabelul de carieră (sezonul curent). Titlurile coloanelor
    stau doar în antet (title=...), valorile doar în rândul de date — se
    împerechează pe poziție; coloanele diferă după post (portar vs. câmp)."""
    i = html.find("careerTab__row--main")
    if i < 0:
        return None, None
    j = html.find('class="careerTab__row"', i)
    if j < 0:
        return None, None
    antet = html[i:j]
    titluri = re.findall(r'careerTab__stat[^"]*" title="([^"]+)"', antet)
    k = html.find("careerTab__row", j + 25)
    frag = html[j:k if k > 0 else j + 6000]
    sezon = re.search(r'careerTab__season"[^>]*>([^<]+)<', frag)
    brute = re.findall(r'careerTab__stat[^"]*"[^>]*>(.*?)</div>', frag, re.S)
    valori = [re.sub(r"<[^>]+>", "", v).strip() for v in brute]
    stats = []
    for titlu, val in zip(titluri, valori):
        if val and val != "-":
            stats.append([titlu, val])
    return (sezon.group(1).strip() if sezon else None), stats


def cariera_jucator(html):
    """Cariera întreagă din primul tabel (liga): numărul de sezoane, anul de
    debut și rândul «Total» (meciuri, goluri...), cu celulele mapate pe
    titlurile din antet după indexul din clasa careerTab__stat--N."""
    i = html.find("careerTab__row--main")
    if i < 0:
        return None
    j = html.find('class="careerTab__row"', i)
    if j < 0:
        return None
    titluri = re.findall(r'careerTab__stat[^"]*" title="([^"]+)"', html[i:j])
    t = html.find("careerTab__row--total", i)
    if t < 0:
        return None
    sezoane = set(re.findall(r'careerTab__season"[^>]*>([^<]+)<', html[i:t]))
    total = {}
    for m in re.finditer(r'careerTab__stat careerTab__stat--(\d+)[^>]*>(.*?)</div>', html[t:t + 2500], re.S):
        idx = int(m.group(1)) - 1
        val = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        if 0 <= idx < len(titluri) and val and val != "-":
            total[titluri[idx]] = val
    out = {"sezoane": len(sezoane)}
    ani = [int(s[:4]) for s in sezoane if re.match(r"^\d{4}", s)]
    if ani:
        out["debut"] = min(ani)
    for cheie, titlu in (("meciuri", "Meciuri jucate"), ("goluri", "Goluri marcate"),
                         ("pase", "Pase decisive"), ("faraGol", "Fără gol")):
        if total.get(titlu):
            out[cheie] = total[titlu]
    return out


# Portretele de lot. Sunt imagini generate cu Nano Banana Pro pornind de la
# fotografiile pe care le are clubul (una per jucător) plus o poză a
# echipamentului, ca tot lotul să arate ca o singură ședință foto de studio.
# Pentru fiecare jucător există trei poze în assets/img/lot/fotbal/, cu sufixele
# -incrucisate, -default și -spate; pe card intră cea aleasă mai jos, iar
# celelalte două rămân în depozit ca să poată fi schimbate oricând doar
# rescriind sufixul aici.
#
# Poza alternează din card în card: primul brațe încrucișate, al doilea default,
# al treilea mâinile la spate, apoi de la capăt. ATENȚIE: contează ordinea în
# care lot.js desenează cardurile, care este pe posturi (întâi portarii, apoi
# fundașii, mijlocașii, atacanții) — nu ordinea din echipe.json. Lista de mai
# jos este scrisă chiar în ordinea de pe pagină, ca să se vadă alternanța.
# Dacă lotul se schimbă, ordinea se recalculează de acolo.
#
# Jucătorii pentru care clubul nu are încă nicio fotografie primesc silueta.
# Se aplică la fiecare rulare, ca să nu se piardă la refresh.
SILUETA = "assets/img/lot/fotbal/silueta.jpg"


def _p(nume):
    return "assets/img/lot/fotbal/%s.jpg" % nume


POZE_CLUB = {
    "fotbal": {
        # portari
        "Racasan Mihai": _p("racasan-mihai-incrucisate"),
        "Glodean Alexandru": _p("glodean-alexandru-default"),
        "Maxim Alexandru": _p("maxim-alexandru-spate"),
        "Predut Catalin": _p("predut-catalin-incrucisate"),
        # fundași
        "Baraitaru Mario": _p("baraitaru-mario-default"),
        "Georgescu Alex": _p("georgescu-alex-spate"),
        "Munoz Pol": _p("munoz-pol-incrucisate"),
        "Riza Robert": _p("riza-robert-default"),
        "Serbanica Daniel": _p("serbanica-daniel-spate"),
        "Stancu Claudiu": _p("stancu-claudiu-incrucisate"),
        "Ureche Alexandru": _p("ureche-alexandru-default"),
        "Andres Ionut": _p("andres-ionut-spate"),
        "Tolu Eduard": _p("tolu-eduard-incrucisate"),
        # mijlocași
        "Gheoroae Stefan": _p("gheoroae-stefan-default"),
        "Granja Ronald": _p("granja-ronald-spate"),
        "Lapadatescu Robert": _p("lapadatescu-robert-incrucisate"),
        "Pacionel Emilian": _p("pacionel-emilian-default"),
        "Rauta Alexandru": _p("rauta-alexandru-spate"),
        "Solcan Alexandru Stefano": _p("solcan-alexandru-stefano-incrucisate"),
        "Velea Rares": _p("velea-rares-default"),
        "Joia Antonio": SILUETA,
        # atacanți
        "Mihaiu Andreas": _p("mihaiu-andreas-incrucisate"),
        "Muntean Denys": _p("muntean-denys-incrucisate"),
        "Radu Constantin": _p("radu-constantin-spate"),
        "Serban Sebastian": _p("serban-sebastian-default"),
        "Tabarcea Matei": _p("tabarcea-matei-incrucisate"),
        # fără post trecut în lot
        "Bordusanu Antonio": _p("bordusanu-antonio-spate"),
        "Magyari Szilard": _p("magyari-szilard-default"),
        "Matis Razvan": _p("matis-razvan-incrucisate"),
        "Nastasie Ionut": SILUETA,
        "Sorescu Yanis": _p("sorescu-yanis-spate"),
        "Stan Alexandru": _p("stan-alexandru-default"),
        "Mbanga Jean": _p("mbanga-jean-incrucisate"),
        "Stan Abel": _p("stan-abel-spate"),
        "Tudorache Alexandru": SILUETA,
    },
    "handbal": {},
}


def bio_jucator(html):
    """Data nașterii și valoarea de piață din antetul paginii jucătorului."""
    out = {}
    m = re.search(r'V[âa]rst[ăa].{0,400}?\((\d{2}\.\d{2}\.\d{4})\)', html, re.S)
    if m:
        out["nascut"] = m.group(1)
    m = re.search(r'Valoare de pia[țt][ăa].{0,400}?>\s*([€$][^<]+)<', html, re.S)
    if m:
        out["valoare"] = m.group(1).strip()
    return out


def api_wiki(wiki, params):
    u = "https://" + wiki + "/w/api.php?format=json&" + params
    req = urllib.request.Request(u, headers={"User-Agent": "CSMSlatinaSite/1.0 (site oficial club)"})
    with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
        return json.load(r)


# Jucători cu articol propriu pe ro.wikipedia, confirmați prin legăturile din
# articolele despre club (identitate certă — nu căutăm după nume, ca să nu
# riscăm confuzii de persoane). De aici luăm poza, înălțimea și data nașterii.
WIKI_JUCATORI = {
    "handbal": {
        "Merve Erbektaș": "Merve Erbektaş",
        "Jovana Sazdovska": "Jovana Sazdovska",
        "Ivana Gakidova": "Ivana Gakidova",
        "Döne Gül Bozdoğan": "Döne Gül Bozdoğan",
        "Andreea Bogdanovici": "Andreea Bogdanovici",
        "Sanja Premović": "Sanja Premović",
    },
    "fotbal": {
        "Nastasie Ionut": "Ionuț Năstăsie",
    },
}


def imbogateste_wiki(juc, titlu, sport_dir):
    """Completează jucătorul cu înălțime + data nașterii (Wikidata) și
    portretul din infobox (licență liberă, cu credit de atribuire)."""
    q = urllib.request.quote(titlu)
    d = api_wiki("ro.wikipedia.org",
                 "action=query&prop=pageprops%7Cpageimages&ppprop=wikibase_item"
                 "&piprop=thumbnail%7Cname&pithumbsize=500&redirects=1&titles=" + q)
    pagina = list(d["query"]["pages"].values())[0]

    qid = pagina.get("pageprops", {}).get("wikibase_item")
    if qid:
        time.sleep(1.5)
        ent = api_wiki("www.wikidata.org",
                       "action=wbgetentities&props=claims&ids=" + qid)["entities"][qid]

        def prima(prop):
            c = ent.get("claims", {}).get(prop)
            return c[0]["mainsnak"].get("datavalue", {}).get("value") if c else None

        h = prima("P2048")  # înălțimea; poate veni în cm sau în metri
        if isinstance(h, dict) and h.get("amount"):
            nr = float(h["amount"].lstrip("+"))
            juc["inaltime"] = int(round(nr)) if nr > 3 else int(round(nr * 100))
        g = prima("P2067")  # greutatea (kg)
        if isinstance(g, dict) and g.get("amount"):
            juc["greutate"] = int(round(float(g["amount"].lstrip("+"))))
        dn = prima("P569")  # data nașterii, doar dacă e cunoscută la zi (precizie 11)
        if isinstance(dn, dict) and dn.get("precision", 0) >= 11 and dn.get("time", "").startswith("+"):
            an, luna, zi = dn["time"][1:11].split("-")
            juc.setdefault("nascut", "%s.%s.%s" % (zi, luna, an))
        ln = prima("P19")  # locul nașterii — Q-id, rezolvat la eticheta în română
        if isinstance(ln, dict) and ln.get("id"):
            time.sleep(1.5)
            et = api_wiki("www.wikidata.org",
                          "action=wbgetentities&props=labels&languages=ro%7Cen&ids=" + ln["id"])
            etichete = et["entities"][ln["id"]].get("labels", {})
            loc = (etichete.get("ro") or etichete.get("en") or {}).get("value")
            if loc:
                juc["origine"] = loc

    th, fisier = pagina.get("thumbnail"), pagina.get("pageimage")
    if th and fisier:
        time.sleep(1.5)
        d2 = api_wiki("ro.wikipedia.org",
                      "action=query&prop=imageinfo&iiprop=extmetadata&titles=" +
                      urllib.request.quote("File:" + fisier))
        info = list(d2["query"]["pages"].values())[0].get("imageinfo", [{}])[0].get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", info.get("Artist", {}).get("value", "")).strip()
        # formulările tehnice de pe Commons („The original uploader was X at ...") -> doar numele
        artist = re.sub(r"(?i)^the original uploader was\s+", "", artist)
        artist = re.split(r"\s+at\s+", artist)[0].strip().rstrip(".")
        licenta = info.get("LicenseShortName", {}).get("value", "")
        radacina = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        director = os.path.join(radacina, "assets", "img", "lot", sport_dir)
        os.makedirs(director, exist_ok=True)
        cale = os.path.join(director, slug(juc["nume"]) + ".jpg")
        req = urllib.request.Request(th["source"], headers={"User-Agent": "CSMSlatinaSite/1.0"})
        with urllib.request.urlopen(req, timeout=25, context=CTX) as r, open(cale, "wb") as f:
            f.write(r.read())
        credit = "Foto: " + (artist or "Wikimedia Commons")
        if licenta:
            credit += ", " + licenta
        credit += " (Wikimedia)"
        juc["poza"] = "assets/img/lot/" + sport_dir + "/" + slug(juc["nume"]) + ".jpg"
        juc["pozaCredit"] = credit


def slug(nume):
    tabel = str.maketrans("ăâîșțĂÂÎȘȚéöüşğ", "aaistAAISTeousg")
    curat = nume.translate(tabel)
    return re.sub(r"[^a-z0-9]+", "-", curat.lower()).strip("-")


def main():
    acum = int(time.time())
    date = {"actualizat": acum}
    for cheie, cfg in ECHIPE.items():
        echipa = {"competitie": cfg["competitie"], "flashscore": cfg["baza"] + "meciuri/"}
        try:
            program_html = descarca(cfg["baza"] + "meciuri/")
            rezultate_html = descarca(cfg["baza"] + "rezultate/")
        except Exception as e:
            print("AVERTISMENT: meciuri %s: %s" % (cheie, e), file=sys.stderr)
            continue
        program = [rezumat_meci(m) for m in extrage_meciuri(program_html)
                   if m["stare"] == "1" and m["timestamp"] > acum][:5]
        rezultate = [rezumat_meci(m) for m in extrage_meciuri(rezultate_html)
                     if m["stare"] == "3" and "scor" in m][-6:]
        echipa["program"] = program
        echipa["rezultate"] = list(reversed(rezultate))  # cele mai noi primele
        echipa["forma"] = "".join(r.get("forma", "?") for r in rezultate[-5:])
        if cfg["areLot"]:
            try:
                lot, antrenor = lot_fotbal(descarca(cfg["baza"] + "lot/"))
                echipa["lot"] = lot
                if antrenor:
                    echipa["antrenor"] = antrenor
                # statisticile sezonului curent, de pe pagina fiecărui jucător
                for juc in lot:
                    try:
                        pagina = descarca(juc["url"])
                        sezon, stats = statistici_jucator(pagina)
                        if stats:
                            juc["sezonStats"] = sezon
                            juc["stats"] = stats
                        juc.update(bio_jucator(pagina))
                        cariera = cariera_jucator(pagina)
                        if cariera:
                            juc["cariera"] = cariera
                    except Exception as e:
                        print("AVERTISMENT: stats %s: %s" % (juc["nume"], e), file=sys.stderr)
                    time.sleep(0.25)
            except Exception as e:
                print("AVERTISMENT: lot %s: %s" % (cheie, e), file=sys.stderr)
        print("%s: %d program, %d rezultate, forma %s, lot %d" % (
            cheie, len(program), len(echipa["rezultate"]), echipa["forma"], len(echipa.get("lot", []))))
        date[cheie] = echipa

    date["handbal"]["lot"] = LOT_HANDBAL
    date["handbal"]["sursaLot"] = "Wikipedia — CSM Slatina (handbal feminin), lotul 2024/25"
    for cheie in ("fotbal", "handbal"):
        for juc in date.get(cheie, {}).get("lot", []):
            titlu = WIKI_JUCATORI.get(cheie, {}).get(juc["nume"])
            if titlu:
                try:
                    time.sleep(1.5)  # politete fata de API-ul Wikipedia (rate limit)
                    imbogateste_wiki(juc, titlu, cheie)
                    print("wiki:", juc["nume"], "->",
                          {k: juc[k] for k in ("inaltime", "nascut", "poza") if k in juc})
                except Exception as e:
                    print("AVERTISMENT: wiki %s: %s" % (juc["nume"], e), file=sys.stderr)
            # vârsta lipsește în lotul de handbal — o calculăm din data nașterii
            if juc.get("nascut") and not juc.get("varsta"):
                zi, luna, an = (int(x) for x in juc["nascut"].split("."))
                azi = time.localtime()
                juc["varsta"] = azi.tm_year - an - ((azi.tm_mon, azi.tm_mday) < (luna, zi))
            # portretele de lot au prioritate fata de pozele luate din Wikidata
            poza_club = POZE_CLUB.get(cheie, {}).get(juc["nume"])
            if poza_club:
                juc["poza"] = poza_club
                juc["pozaCredit"] = ("Siluetă generată AI" if poza_club == SILUETA
                                     else "Portret generat AI, după fotografiile CSM Slatina")

    radacina = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cale = os.path.join(radacina, "data", "echipe.json")

    # un lot trecut pe manual din panoul de administrare NU se rescrie:
    # pastram exact ce e in fisierul curent pentru sportul respectiv
    cale_supra = os.path.join(radacina, "data", "suprascrieri.json")
    if os.path.exists(cale_supra) and os.path.exists(cale):
        with io.open(cale_supra, encoding="utf-8") as f:
            lot_manual = json.load(f).get("lot", {})
        if lot_manual:
            with io.open(cale, encoding="utf-8") as f:
                vechi = json.load(f)
            for sport, activ in lot_manual.items():
                if activ and sport in vechi and sport in date:
                    date[sport]["lot"] = vechi[sport].get("lot", [])
                    print("lot %s: pe manual, pastrat neschimbat" % sport)

    os.makedirs(os.path.dirname(cale), exist_ok=True)
    with io.open(cale, "w", encoding="utf-8") as f:
        json.dump(date, f, ensure_ascii=False, indent=1)
    print("Scris", cale)


if __name__ == "__main__":
    main()
