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

# Lotul de handbal — lotul oficial 2026/2027, cu datele și fotografiile din
# ședința foto a clubului. De actualizat manual la schimbări.
LOT_HANDBAL = [
    {"numar": 16, "nume": "Elena Nagy", "post": "Portar", "nat": "România", "varsta": 28, "inaltime": 176, "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/16-nagy.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 87, "nume": "Sakura Hauge", "post": "Portar", "nat": "Norvegia", "varsta": 39, "inaltime": 174, "origine": "Bergen", "nascut": "-", "poza": "assets/img/lot/handbal/87-hauge.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 91, "nume": "Mara Zaharia", "post": "Portar", "nat": "România", "varsta": 23, "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/91-zaharia.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 2, "nume": "Nicoleta Dinca", "post": "Extremă stânga", "nat": "România", "varsta": 38, "inaltime": 171, "origine": "Slatina", "nascut": "-", "poza": "assets/img/lot/handbal/02-dinca.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 96, "nume": "Hermina Olaru", "post": "Extremă stânga", "nat": "România", "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/96-olaru.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 3, "nume": "Adina Florescu", "post": "Inter dreapta", "nat": "România", "varsta": 26, "inaltime": 170, "origine": "Slatina", "nascut": "-", "poza": "assets/img/lot/handbal/03-florescu.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 11, "nume": "Valentina Lecu", "post": "Extremă dreapta", "nat": "România", "varsta": 21, "inaltime": 170, "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/11-lecu.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 71, "nume": "Adrianna Górna", "post": "Extremă dreapta", "nat": "Polonia", "varsta": 30, "inaltime": 171, "origine": "Kwidzyn", "nascut": "-", "poza": "assets/img/lot/handbal/71-gorna.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 9, "nume": "Elena Popescu", "post": "Pivot", "nat": "România", "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/09-popescu.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 23, "nume": "Andreea Țîrle", "post": "Pivot", "nat": "România", "varsta": 24, "inaltime": 177, "origine": "Petroșani", "nascut": "-", "poza": "assets/img/lot/handbal/23-tirle.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 97, "nume": "Nikolina Vukčević", "post": "Pivot", "nat": "Muntenegru", "varsta": 26, "inaltime": 180, "origine": "Podgorica", "nascut": "-", "poza": "assets/img/lot/handbal/97-vukcevic.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 14, "nume": "Tamara Pál", "post": "Centru", "nat": "Ungaria", "varsta": 25, "inaltime": 174, "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/14-pal.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 22, "nume": "Luciana Popescu", "post": "Inter dreapta", "nat": "România", "varsta": 38, "inaltime": 176, "origine": "Slatina", "nascut": "-", "poza": "assets/img/lot/handbal/22-popescu.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 33, "nume": "Amelia Lundbäck", "post": "Centru", "nat": "Suedia", "varsta": 27, "inaltime": 176, "origine": "Stensjön", "nascut": "-", "poza": "assets/img/lot/handbal/33-lundback.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 4, "nume": "Greta Kácsor", "post": "Inter stânga", "nat": "Ungaria", "varsta": 26, "inaltime": 173, "origine": "Budapesta", "nascut": "-", "poza": "assets/img/lot/handbal/04-kacsor.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 10, "nume": "Sonia Vasiliu", "post": "Pivot", "nat": "România", "varsta": 30, "origine": "-", "nascut": "-", "poza": "assets/img/lot/handbal/10-vasiliu.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 21, "nume": "Magda Cazanga", "post": "Inter stânga", "nat": "Angola", "varsta": 35, "inaltime": 177, "origine": "-", "nascut": "28.05.1991", "poza": "assets/img/lot/handbal/21-cazanga.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 98, "nume": "Mara Matea", "post": "Inter stânga", "nat": "România", "varsta": 19, "inaltime": 181, "origine": "-", "nascut": "01.01.2007", "poza": "assets/img/lot/handbal/98-matea.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 13, "nume": "Kaho Nakayama", "post": "Inter dreapta", "nat": "Japonia", "varsta": 27, "inaltime": 172, "origine": "Okayama", "nascut": "23.10.1998", "poza": "assets/img/lot/handbal/13-nakayama.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
    {"numar": 28, "nume": "Nikoletta Papp", "post": "Inter dreapta", "nat": "Ungaria", "varsta": 30, "inaltime": 180, "origine": "Budapesta", "nascut": "-", "poza": "assets/img/lot/handbal/28-papp.jpg", "pozaCredit": "Ședința foto oficială CSM Slatina, sezonul 2026–2027"},
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
# Fotografiile de lot: fiecare jucător are trei variante (brațe încrucișate,
# poziție normală, mâinile la spate). Aici stă doar numele de bază; varianta se
# alege automat, ca să alterneze din card în card în ordinea de pe pagină
# (portari, apoi fundași centrali, laterali, mijlocași, atacanți). Așa rămâne
# alternanța corectă și când clubul schimbă lotul sau posturile.
#
# Cheia e numele oficial, din data/lot-fotbal.json. Jucătorii pentru care
# clubul nu are încă nicio fotografie primesc silueta.
SILUETA = "assets/img/lot/fotbal/silueta.jpg"
VARIANTE = ("incrucisate", "default", "spate")

POZE_CLUB = {
    "fotbal": {
        "Preduț Alexandru": "predut-catalin",
        "Vîlceleanu Darius": None,
        "Răcășan Mihai": "racasan-mihai",
        "Stan Abel": "stan-abel",
        "Riza Robert": "riza-robert",
        "Andres Ionut": "andres-ionut",
        "Serbanica Daniel": "serbanica-daniel",
        "Baraitaru Mario": "baraitaru-mario",
        "Ureche Alexandru": "ureche-alexandru",
        "Munoz Pol": "munoz-pol",
        "Stancu Claudiu": "stancu-claudiu",
        "Radu Constantin": "radu-constantin",
        "Georgescu Alex": "georgescu-alex",
        "Rauta Alexandru": "rauta-alexandru",
        "Lăpădătescu Robert": "lapadatescu-robert",
        "Năstăsie Ionuț": None,
        "Matis Razvan": "matis-razvan",
        "Pacionel Emilian": "pacionel-emilian",
        "Gheoroae Stefan": "gheoroae-stefan",
        "Solcan Alexandru": "solcan-alexandru-stefano",
        "Stan Alexandru": "stan-alexandru",
        "Sorescu Yanis": "sorescu-yanis",
        "Magyari Szilard": "magyari-szilard",
        "Bordusanu Antonio": "bordusanu-antonio",
        "Mihaiu Andreas": "mihaiu-andreas",
        "Granja Roland": "granja-ronald",
        "Tolu Eduard": "tolu-eduard",
        "Mbanga Calvin": "mbanga-jean",
        "Velea Rares": "velea-rares",
    },
    "handbal": {},
}

# ordinea posturilor pe pagină; aceeași cu GRUPE_FOTBAL din v4/js/lot.js
ORDINE_POSTURI = ["Portar", "Fundaș central", "Fundaș lateral",
                  "Mijlocaș central", "Mijlocaș lateral",
                  "Atacant central", "Atacant lateral"]


def _fara_diacritice(t):
    return (t.replace("ă", "a").replace("â", "a").replace("î", "i")
             .replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t")
             .lower().strip())


def aplica_lot_club(lot, cale_lot):
    """Lotul oficial al clubului are ultimul cuvânt.

    Flashscore ține propria listă: are jucători plecați, nume scrise altfel
    („Mbanga Jean" în loc de „Mbanga Calvin"), numere vechi și doar patru
    posturi. Clubul ne trimite lotul real, cu posturile amănunțite. Păstrăm de
    pe Flashscore doar ce el știe mai bine — statisticile, cariera, linkul —
    și le lipim peste jucătorii din lotul oficial. Cine nu e în lotul oficial
    nu apare pe site.
    """
    with io.open(cale_lot, encoding="utf-8") as fh:
        club = json.load(fh)
    dupa_nume = {_fara_diacritice(j.get("nume", "")): j for j in lot}
    iesire = []
    for c in club["jucatori"]:
        # cautam si dupa numele de pe Flashscore, si dupa cel oficial: asa
        # merge si cand scriptul e rulat peste un echipe.json deja aliniat
        vechi = None
        for cheie in (c.get("numeFlashscore"), c["nume"]):
            if cheie and _fara_diacritice(cheie) in dupa_nume:
                vechi = dupa_nume[_fara_diacritice(cheie)]
                break
        juc = dict(vechi) if vechi else {}
        juc.update({k: c[k] for k in ("numar", "nume", "post", "varsta", "nascut") if k in c})
        juc.setdefault("nat", "România")
        iesire.append(juc)
        if not vechi:
            print("lot club: %s nu are corespondent pe Flashscore (fără statistici)" % c["nume"])
    cunoscute = set()
    for c in club["jucatori"]:
        for cheie in (c.get("numeFlashscore"), c["nume"]):
            if cheie:
                cunoscute.add(_fara_diacritice(cheie))
    lipsa = [j["nume"] for j in lot if _fara_diacritice(j["nume"]) not in cunoscute]
    if lipsa:
        print("lot club: scoși (nu sunt în lotul oficial): " + ", ".join(lipsa))
    return iesire, club.get("sursa", "")


def pune_pozele(lot, sport):
    """Varianta de portret alternează din card în card, în ordinea de pe pagină."""
    poze = POZE_CLUB.get(sport, {})
    if not poze:
        return
    ordine = sorted(range(len(lot)),
                    key=lambda k: (ORDINE_POSTURI.index(lot[k]["post"])
                                   if lot[k].get("post") in ORDINE_POSTURI else len(ORDINE_POSTURI)))
    for rand, k in enumerate(ordine):
        juc = lot[k]
        baza = poze.get(juc["nume"], "")
        if baza:
            juc["poza"] = "assets/img/lot/%s/%s-%s.jpg" % (sport, baza, VARIANTE[rand % len(VARIANTE)])
            juc["pozaCredit"] = "Portret generat AI, după fotografiile CSM Slatina"
        else:
            juc["poza"] = SILUETA
            juc["pozaCredit"] = "Siluetă generată AI"


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
    "handbal": {},
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
            # lotul oficial al clubului are ultimul cuvânt
            cale_lot = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                    "data", "lot-fotbal.json")
            if os.path.exists(cale_lot) and echipa.get("lot"):
                echipa["lot"], sursa = aplica_lot_club(echipa["lot"], cale_lot)
                if sursa:
                    echipa["sursaLot"] = sursa
        print("%s: %d program, %d rezultate, forma %s, lot %d" % (
            cheie, len(program), len(echipa["rezultate"]), echipa["forma"], len(echipa.get("lot", []))))
        date[cheie] = echipa

    date["handbal"]["lot"] = LOT_HANDBAL
    date["handbal"]["sursaLot"] = "Lotul oficial CSM Slatina, sezonul 2026/2027 (ședința foto a clubului)"
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
    for cheie in ("fotbal", "handbal"):
        if date.get(cheie, {}).get("lot"):
            pune_pozele(date[cheie]["lot"], cheie)

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
