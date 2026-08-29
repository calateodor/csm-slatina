# -*- coding: utf-8 -*-
"""Reduce greutatea imaginilor care încarcă inutil paginile.

Trei feluri de risipă, toate măsurate pe site înainte de a scrie scriptul:
 - fotografii mari servite unor casete mici (stema de 641px afișată la 42px,
   cardurile de secție de 900px afișate la 277px);
 - fotografii rămase în JPEG sau PNG acolo unde WebP ar fi de câteva ori
   mai mic la aceeași calitate;
 - fișiere la care nimeni nu se mai uită.

Scriptul scrie fișierele noi și raportează economia. Referințele din HTML
și CSS se schimbă separat, cu scripts/actualizeaza-referinte-imagini.py.

Rulare (din rădăcina repository-ului):
    python scripts/optimizeaza-imagini.py
"""
import os
from PIL import Image

VERSIUNE = "v4"
RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RADACINA, VERSIUNE, "assets", "img")

# (sursa, destinatie, latime maxima, calitate)
LUCRARI = [
    # stema: se vede la 42px în antet și 92px în subsol — 320px acoperă și ecranele 2x
    ("logo.png", "logo.webp", 320, 90),
    # fundalul de secțiune, folosit ca imagine CSS pe toată lățimea
    ("fundal.jpg", "fundal.webp", 2000, 78),
    # fotografia din blocul „despre" (index) și miniatura de pe padel
    ("hero-static.jpg", "hero-static.webp", 1600, 80),
    # atleții din hero: rămân mari, dar se pot recompune mai eficient
    ("atleti.webp", "atleti.webp", 1800, 80),
    # lotul de fotbal decupat, singurul PNG greu rămas
    ("fotbal-echipa-calendar.png", "fotbal-echipa-calendar.webp", 1800, 82),
    # harta bazei: se vede într-o casetă de maximum 1100px
    ("harta/baza-aeriana.webp", "harta/baza-aeriana.webp", 1800, 80),
]

# cardurile de secție: pe telefon caseta are 343px, deci 800px acoperă și
# ecranele cu densitate mare, fără cele 900px de dinainte
CARDURI = ["atletism", "box", "fotbal", "handbal", "inot", "judo", "karate",
           "kempo", "lupte", "sah", "tenis-de-camp", "tenis-de-masa"]
for slug in CARDURI:
    LUCRARI.append(("cards/%s.webp" % slug, "cards/%s.webp" % slug, 800, 80))


def octeti(cale):
    return os.path.getsize(cale) if os.path.exists(cale) else 0


def main():
    inainte = dupa = 0
    for sursa, dest, latime, calitate in LUCRARI:
        cs = os.path.join(IMG, sursa.replace("/", os.sep))
        cd = os.path.join(IMG, dest.replace("/", os.sep))
        if not os.path.exists(cs):
            print("lipsește:", sursa)
            continue
        vechi = octeti(cs)
        im = Image.open(cs)
        if im.mode == "P":
            im = im.convert("RGBA")
        if im.width > latime:
            inalt = int(round(im.height * latime / float(im.width)))
            im = im.resize((latime, inalt), Image.LANCZOS)
        are_alfa = im.mode in ("RGBA", "LA")
        im.save(cd, "WEBP", quality=calitate, method=6, lossless=False)
        nou = octeti(cd)
        inainte += vechi
        dupa += nou
        print("%-34s %6d KB -> %5d KB %s" % (dest, vechi / 1024, nou / 1024,
                                             "(cu transparență)" if are_alfa else ""))
    print("-" * 62)
    print("total: %d KB -> %d KB (economie %d KB)"
          % (inainte / 1024, dupa / 1024, (inainte - dupa) / 1024))


if __name__ == "__main__":
    main()
