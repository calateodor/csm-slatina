# -*- coding: utf-8 -*-
"""Ia poziția CSM Slatina din clasamentul cluburilor publicat de FR Box
și o scrie în v4/data/box.json.

De ce doar atât: recordul unui boxer (34-11-0 etc.) există doar pe BoxRec,
care e păzit de Cloudflare ȘI interzice prin termeni extragerea automată —
partea aia se ține de mână în box.json, din panoul de administrare.
Clasamentul cluburilor e însă public și accesibil pe frbox.ro, deci pe
acela îl aducem singur.

Rulare (din rădăcina repository-ului):
    python scripts/actualizeaza-box.py
"""
import io
import json
import os
import re
import ssl
import urllib.request

CLUB = "CSM Slatina"
AN = 2025
ADRESA = "https://frbox.ro/clasament-cluburi-%d/" % AN
RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FISIER = os.path.join(RADACINA, "v4", "data", "box.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def ia_pagina(adresa):
    # pe mașina asta lanțul SSL pică (ceas/2026), deci verificarea e oprită
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    cerere = urllib.request.Request(adresa, headers={"User-Agent": UA})
    with urllib.request.urlopen(cerere, timeout=40, context=context) as r:
        return r.read().decode("utf-8", "replace")


def curata(html):
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text)


def gaseste_clubul(text):
    """Clasamentul e o listă: „<loc> <club> <sportivi> <locuri> <puncte>".
    Căutăm numele clubului și citim cifrele din jurul lui."""
    m = re.search(r"(\d{1,2})\s+" + re.escape(CLUB) + r"\s+(\d+)\s+(\d+)\s+([\d.,]+)", text)
    if not m:
        return None
    return {
        "an": AN,
        "loc": int(m.group(1)),
        "sportivi": int(m.group(2)),
        "puncte": m.group(4).replace(",", "."),
        "sursa": ADRESA,
    }


def main():
    date = json.load(io.open(FISIER, encoding="utf-8"))
    try:
        gasit = gaseste_clubul(curata(ia_pagina(ADRESA)))
    except Exception as e:
        print("nu am putut citi clasamentul:", e)
        return
    if not gasit:
        print("clubul nu apare în clasamentul", AN, "— fișierul rămâne neatins")
        return
    vechi = date.get("clasamentCluburi", {})
    gasit["_comentariu"] = vechi.get("_comentariu", "")
    date["clasamentCluburi"] = gasit
    io.open(FISIER, "w", encoding="utf-8", newline="\n").write(
        json.dumps(date, ensure_ascii=False, indent=2) + "\n")
    print("actualizat: locul %(loc)d, %(puncte)s puncte, %(sportivi)d sportivi" % gasit)


if __name__ == "__main__":
    main()
