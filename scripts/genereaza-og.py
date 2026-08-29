# -*- coding: utf-8 -*-
"""Compune imaginile de partajare (Open Graph, 1200x630) pentru site.

Fiecare imagine e o decupare din fotografia proprie a paginii, cu un
degrade bleumarin in partea de jos si stema clubului in coltul din stanga
jos - fara text redat cu font, ca sa nu depinda de fonturile instalate pe
calculator. Pagina principala face exceptie: fotografia ei contine deja
sloganul, deci ramane curata.

Rulare (din radacina repository-ului):
    python scripts/genereaza-og.py
"""
import os
from PIL import Image

VERSIUNE = "v4"
L, I = 1200, 630
NAVY = (12, 28, 58)

RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAZA = os.path.join(RADACINA, VERSIUNE, "assets", "img")
IESIRE = os.path.join(BAZA, "og")

SECTII = [
    "atletism", "box", "fotbal", "handbal", "inot", "judo", "karate",
    "kempo", "lupte", "sah", "tenis-de-camp", "tenis-de-masa",
]

# (sursa relativa la assets/img, nume iesire, stema?, ancora verticala, taiere de jos)
LUCRARI = [
    ("hero-static.jpg", "csm-slatina.jpg", False, 0.5, 0.0),
    ("plaja-v2/aerian-2560.webp", "club-nautic.jpg", True, 0.0, 0.26),
    ("plaja-lumina/erou.webp", "plaja-olt.jpg", True, 0.5, 0.0),
    ("plaja-v2/sv-padel.webp", "padel.jpg", True, 0.5, 0.0),
    ("fotbal-tribuna.jpg", "sectii.jpg", True, 0.5, 0.0),
]
for slug in SECTII:
    erou = "sectii/%s/erou.webp" % slug
    sursa = erou if os.path.exists(os.path.join(BAZA, erou.replace("/", os.sep))) \
        else "cards/%s.webp" % slug
    LUCRARI.append((sursa, "sectii-%s.jpg" % slug, True, 0.4, 0.0))


def decupeaza(im, ancora=0.5, taie_jos=0.0):
    """Umple 1200x630; taie_jos scoate o fasie de jos inainte de decupare."""
    im = im.convert("RGB")
    if taie_jos:
        im = im.crop((0, 0, im.width, int(im.height * (1 - taie_jos))))
    tinta = L / float(I)
    l, i = im.size
    if l / float(i) > tinta:
        nou_l = int(round(i * tinta))
        st = (l - nou_l) // 2
        im = im.crop((st, 0, st + nou_l, i))
    else:
        nou_i = int(round(l / tinta))
        sus = int((i - nou_i) * ancora)
        im = im.crop((0, sus, l, sus + nou_i))
    return im.resize((L, I), Image.LANCZOS)


def degrade_jos(im, inalt=260, opac=200):
    strat = Image.new("RGBA", (L, I), (0, 0, 0, 0))
    px = strat.load()
    for y in range(I - inalt, I):
        t = (y - (I - inalt)) / float(inalt)
        a = int(opac * (t ** 1.6))
        for x in range(L):
            px[x, y] = (NAVY[0], NAVY[1], NAVY[2], a)
    return Image.alpha_composite(im.convert("RGBA"), strat)


def pune_stema(im):
    stema = Image.open(os.path.join(BAZA, "logo.png")).convert("RGBA")
    h = 130
    w = int(round(stema.width * h / float(stema.height)))
    stema = stema.resize((w, h), Image.LANCZOS)
    im.paste(stema, (56, I - h - 46), stema)
    return im


def main():
    if not os.path.isdir(IESIRE):
        os.makedirs(IESIRE)
    total = 0
    for sursa, nume, cu_stema, ancora, taie in LUCRARI:
        cale = os.path.join(BAZA, sursa.replace("/", os.sep))
        if not os.path.exists(cale):
            print("lipseste:", sursa)
            continue
        im = decupeaza(Image.open(cale), ancora, taie)
        if cu_stema:
            im = pune_stema(degrade_jos(im))
        dest = os.path.join(IESIRE, nume)
        im.convert("RGB").save(dest, "JPEG", quality=82, optimize=True, progressive=True)
        total += 1
        print("%-26s %5d KB" % (nume, os.path.getsize(dest) / 1024))
    print("gata:", total, "imagini")


if __name__ == "__main__":
    main()
