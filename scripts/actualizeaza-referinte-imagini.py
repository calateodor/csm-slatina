# -*- coding: utf-8 -*-
"""Leagă paginile de imaginile optimizate și le dă dimensiunile reale.

Două lucruri:
 1. înlocuiește trimiterile către fișierele grele (logo.png, fundal.jpg,
    hero-static.jpg, fotbal-echipa-calendar.png) cu variantele WebP;
    stema rămâne PNG acolo unde trebuie să fie PNG — iconița din tab și
    imaginile de partajare.
 2. scrie width și height pe fiecare <img> care nu le are. Fără ele
    browserul nu știe cât loc să rezerve, așa că pagina saltă în timp ce
    se încarcă fotografiile (Cumulative Layout Shift).

Rulare (din rădăcina repository-ului):
    python scripts/actualizeaza-referinte-imagini.py
"""
import io
import os
import re
from PIL import Image

VERSIUNE = "v4"
RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(RADACINA, VERSIUNE)

INLOCUIRI_HTML = [
    ('src="assets/img/logo.png"', 'src="assets/img/logo.webp"'),
    ('src="../assets/img/logo.png"', 'src="../assets/img/logo.webp"'),
    ("assets/img/hero-static.jpg", "assets/img/hero-static.webp"),
    ("assets/img/fotbal-echipa-calendar.png", "assets/img/fotbal-echipa-calendar.webp"),
]
INLOCUIRI_CSS = [
    ("../assets/img/fundal.jpg", "../assets/img/fundal.webp"),
]


def fisiere_html():
    for nume in sorted(os.listdir(SITE)):
        if nume.endswith(".html"):
            yield nume
    sectii = os.path.join(SITE, "sectii")
    for nume in sorted(os.listdir(sectii)):
        if nume.endswith(".html"):
            yield "sectii/" + nume


def dimensiuni(cale):
    try:
        with Image.open(cale) as im:
            return im.size
    except Exception:
        return None


def adauga_dimensiuni(html, rel):
    """Pune width/height pe <img> care nu le au și al căror fișier există."""
    baza = os.path.dirname(os.path.join(SITE, rel.replace("/", os.sep)))
    puse = [0]

    def inlocuieste(m):
        tag = m.group(0)
        # dimensiunile scrise anterior se recalculează: fișierul se poate
        # fi schimbat între timp (reoptimizare), iar valorile vechi ar minți
        tag = re.sub(r'\s+(?:width|height)="\d+"', "", tag)
        s = re.search(r'src="([^"]+)"', tag)
        if not s:
            return tag
        src = s.group(1)
        if src.startswith(("http://", "https://", "data:")):
            return tag
        cale = os.path.normpath(os.path.join(baza, src.replace("/", os.sep)))
        d = dimensiuni(cale)
        if not d:
            return tag
        puse[0] += 1
        return tag[:-1].rstrip() + ' width="%d" height="%d">' % d

    html = re.sub(r"<img\b[^>]*>", inlocuieste, html)
    return html, puse[0]


def main():
    for rel in fisiere_html():
        cale = os.path.join(SITE, rel.replace("/", os.sep))
        html = io.open(cale, encoding="utf-8").read()
        original = html
        for a, b in INLOCUIRI_HTML:
            html = html.replace(a, b)
        html, n = adauga_dimensiuni(html, rel)
        if html != original:
            io.open(cale, "w", encoding="utf-8", newline="\n").write(html)
            print("%-32s %d dimensiuni scrise" % (rel, n))

    css = os.path.join(SITE, "css")
    for nume in sorted(os.listdir(css)):
        if not nume.endswith(".css"):
            continue
        cale = os.path.join(css, nume)
        text = io.open(cale, encoding="utf-8").read()
        nou = text
        for a, b in INLOCUIRI_CSS:
            nou = nou.replace(a, b)
        if nou != text:
            io.open(cale, "w", encoding="utf-8", newline="\n").write(nou)
            print("css:", nume)


if __name__ == "__main__":
    main()
