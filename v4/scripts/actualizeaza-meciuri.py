# -*- coding: utf-8 -*-
"""Actualizează data/meciuri.json cu următoarele meciuri CSM Slatina de pe Flashscore.

Paginile de echipă Flashscore au programul inclus direct în HTML-ul servit
(format feed: înregistrări separate prin «~», câmpuri prin «¬», cheie÷valoare),
deci nu e nevoie de browser — un GET simplu ajunge. Rulare:

    python scripts/actualizeaza-meciuri.py

Poate fi pus într-un GitHub Action pe cron ca datele să se împrospăteze singure
(același script va putea alimenta și postările automate de Facebook mai târziu).
"""
import io
import json
import os
import ssl
import sys
import time
import urllib.request

ECHIPE = [
    {
        "sport": "Fotbal",
        "url": "https://www.flashscore.ro/echipa/csm-slatina/zRqy53ur/meciuri/",
        "id": "zRqy53ur",
    },
    {
        "sport": "Handbal",
        "url": "https://www.flashscore.ro/echipa/csm-slatina/ptT2ffej/meciuri/",
        "id": "ptT2ffej",
    },
]

SEP_REC = "~"
SEP_CAMP = "¬"
SEP_KV = "÷"


def descarca(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return r.read().decode("utf-8", "replace")


def extrage_meciuri(html, sport, url_program):
    """Parcurge feed-ul inline și întoarce meciurile viitoare (AB÷1 = programat)."""
    meciuri = []
    liga = ""
    for rec in html.split(SEP_REC):
        campuri = {}
        for camp in rec.split(SEP_CAMP):
            if SEP_KV in camp:
                k, _, v = camp.partition(SEP_KV)
                campuri[k] = v
        if "ZK" in campuri:  # antet de competiție — valabil pentru meciurile de după el
            liga = campuri["ZK"]
        if campuri.get("AA") and campuri.get("AD") and campuri.get("AE") and campuri.get("AF"):
            if campuri.get("AB") not in (None, "1"):
                continue  # doar meciuri programate, nu finalizate/live
            meciuri.append(
                {
                    "sport": sport,
                    "competitie": liga,
                    "timestamp": int(campuri["AD"]),
                    "gazde": campuri["AE"],
                    "oaspeti": campuri["AF"],
                    "flashscoreId": campuri["AA"],
                    "sursa": url_program,
                }
            )
    unice = {}
    for m in meciuri:  # același meci apare de două ori în pagină — păstrăm o singură intrare
        unice.setdefault(m["flashscoreId"], m)
    meciuri = list(unice.values())
    meciuri.sort(key=lambda m: m["timestamp"])
    return meciuri


def main():
    acum = int(time.time())
    toate = []
    for echipa in ECHIPE:
        try:
            html = descarca(echipa["url"])
        except Exception as e:  # o echipă picată nu blochează restul
            print("AVERTISMENT: nu am putut citi %s: %s" % (echipa["url"], e), file=sys.stderr)
            continue
        viitoare = [m for m in extrage_meciuri(html, echipa["sport"], echipa["url"]) if m["timestamp"] > acum]
        print("%s: %d meciuri viitoare" % (echipa["sport"], len(viitoare)))
        toate.extend(viitoare[:5])  # păstrăm doar primele 5 pe sport, restul nu ne trebuie

    toate.sort(key=lambda m: m["timestamp"])
    radacina = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # suprascrierile din panoul de administrare au ultimul cuvant:
    # un meci marcat manual pastreaza valorile puse de administrator,
    # unul marcat "sters" nu mai apare, iar meciurile adaugate de mana
    # (id manual-*) raman in lista.
    cale_supra = os.path.join(radacina, "data", "suprascrieri.json")
    supra = {}
    if os.path.exists(cale_supra):
        with io.open(cale_supra, encoding="utf-8") as f:
            supra = json.load(f).get("meciuri", {})
    if supra:
        rezultat = []
        for m in toate:
            regula = supra.get(m.get("flashscoreId"))
            if regula == "sters":
                continue
            if isinstance(regula, dict):
                m = dict(m); m.update(regula)
            rezultat.append(m)
        for cheie, regula in supra.items():
            if cheie.startswith("manual-") and isinstance(regula, dict):
                rezultat.append(regula)
        rezultat.sort(key=lambda m: m["timestamp"])
        toate = rezultat

    cale = os.path.join(radacina, "data", "meciuri.json")
    os.makedirs(os.path.dirname(cale), exist_ok=True)
    continut = {"actualizat": acum, "meciuri": toate}
    with io.open(cale, "w", encoding="utf-8") as f:
        json.dump(continut, f, ensure_ascii=False, indent=2)
    print("Scris %s (%d meciuri)" % (cale, len(toate)))


if __name__ == "__main__":
    main()
