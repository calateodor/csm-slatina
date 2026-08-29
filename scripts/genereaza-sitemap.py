# -*- coding: utf-8 -*-
"""Scrie sitemap.xml pentru versiunea publicată a site-ului.

Rulare (din rădăcina repository-ului):
    python scripts/genereaza-sitemap.py

Include doar paginile publice din versiunea curentă. Uneltele interne
(panou, admin, editorul de hartă) și șablonul de articol rămân pe dinafară:
primele nu sunt conținut, ultimul nu are adresă proprie fără parametru.
"""
import io
import os
import time

BAZA = "https://calateodor.github.io/csm-slatina"
VERSIUNE = "v4"
EXCLUSE = {"panou.html", "admin.html", "harta.html", "stire.html"}

# prioritate și frecvență, pe tipuri de pagină
PROFIL = {
    "index.html":       ("1.0", "weekly"),
    "stiri.html":       ("0.9", "daily"),
    "club-nautic.html": ("0.8", "monthly"),
    "plaja-olt.html":   ("0.8", "weekly"),
    "padel.html":       ("0.7", "monthly"),
    "contact.html":     ("0.6", "yearly"),
}
IMPLICIT = ("0.7", "monthly")


def pagini(radacina):
    gasite = []
    for nume in sorted(os.listdir(radacina)):
        if nume.endswith(".html") and nume not in EXCLUSE:
            gasite.append(nume)
    sectii = os.path.join(radacina, "sectii")
    if os.path.isdir(sectii):
        for nume in sorted(os.listdir(sectii)):
            if nume.endswith(".html"):
                gasite.append("sectii/" + nume)
    return gasite


def main():
    radacina = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), VERSIUNE)
    randuri = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for cale in pagini(radacina):
        prio, freq = PROFIL.get(cale, IMPLICIT)
        adresa = BAZA + "/" + VERSIUNE + "/" + ("" if cale == "index.html" else cale)
        mtime = os.path.getmtime(os.path.join(radacina, cale.replace("/", os.sep)))
        randuri += [
            "  <url>",
            "    <loc>%s</loc>" % adresa,
            "    <lastmod>%s</lastmod>" % time.strftime("%Y-%m-%d", time.localtime(mtime)),
            "    <changefreq>%s</changefreq>" % freq,
            "    <priority>%s</priority>" % prio,
            "  </url>",
        ]
    randuri.append("</urlset>")

    iesire = os.path.join(os.path.dirname(radacina), "sitemap.xml")
    io.open(iesire, "w", encoding="utf-8", newline="\n").write("\n".join(randuri) + "\n")
    print("scris:", iesire, "(%d adrese)" % len(pagini(radacina)))


if __name__ == "__main__":
    main()
