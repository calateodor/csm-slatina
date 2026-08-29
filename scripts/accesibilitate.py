# -*- coding: utf-8 -*-
"""Corecturi de accesibilitate aplicate uniform pe toate paginile publice.

1. Link "Sari la conținut" ca prim element din pagina - un om care navigheaza
   de la tastatura trebuie sa poata sari peste antet si meniu.
2. <main id="continut"> ca tinta a acelui link.
3. Titlurile de coloana din meniu si din subsol nu mai sunt <h4>: erau
   singurele titluri de nivel 4 din pagini si rupeau ierarhia (h2 -> h4).
   Devin paragrafe cu aceeasi infatisare.

Idempotent: rularea de doua ori nu strica nimic.

Rulare (din radacina repository-ului):
    python scripts/accesibilitate.py
"""
import io
import os
import re

VERSIUNE = "v4"
RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(RADACINA, VERSIUNE)

SARI = '  <a class="sari-la-continut" href="#continut">Sari la conținut</a>'


def pagini():
    for nume in sorted(os.listdir(SITE)):
        if nume.endswith(".html"):
            yield nume
    sectii = os.path.join(SITE, "sectii")
    for nume in sorted(os.listdir(sectii)):
        if nume.endswith(".html"):
            yield "sectii/" + nume


def main():
    for rel in pagini():
        cale = os.path.join(SITE, rel.replace("/", os.sep))
        html = io.open(cale, encoding="utf-8").read()
        original = html

        # 1 + 2: link de sarit si tinta lui
        if "<main" in html and "sari-la-continut" not in html:
            html = re.sub(r"(<body[^>]*>)", r"\1\n" + SARI, html, count=1)
        if "<main" in html and "id=\"continut\"" not in html:
            html = html.replace("<main>", '<main id="continut">', 1)
            html = re.sub(r'<main (?!id=")', '<main id="continut" ', html, count=1)

        # 3: titluri de coloana
        html = re.sub(r'<h4>(Sporturi de echipă|Sporturi individuale|Club|Secții|Contact)</h4>',
                      r'<p class="col-titlu">\1</p>', html)
        html = re.sub(r'<h4 class="mt">(.*?)</h4>',
                      r'<p class="col-titlu mt">\1</p>', html)

        if html != original:
            io.open(cale, "w", encoding="utf-8", newline="\n").write(html)
            print("ok", rel)


if __name__ == "__main__":
    main()
