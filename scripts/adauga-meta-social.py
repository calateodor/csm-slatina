# -*- coding: utf-8 -*-
"""Pune pe fiecare pagina publica adresa canonica si cartonasul de partajare.

Fara astea, orice link dat pe Facebook sau WhatsApp apare ca un dreptunghi
gol, iar Google vede mai multe adrese cu acelasi continut. Scriptul e
idempotent: sterge blocul pus anterior si il rescrie, deci poate fi rulat
de cate ori e nevoie.

Rulare (din radacina repository-ului):
    python scripts/adauga-meta-social.py
"""
import io
import os
import re

VERSIUNE = "v4"
BAZA_URL = "https://calateodor.github.io/csm-slatina/" + VERSIUNE + "/"
RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(RADACINA, VERSIUNE)

START = "  <!-- === partajare si adresa canonica (scris de scripts/adauga-meta-social.py) === -->"
STOP = "  <!-- === sfarsit partajare === -->"

# unelte interne: nu primesc cartonas, primesc noindex
INTERNE = {"panou.html", "admin.html", "harta.html"}
# sablon de articol: are continut doar cu parametru in adresa
NOINDEX_IN_PLUS = {"stire.html"}

IMAGINI = {
    "index.html": "csm-slatina.jpg",
    "club-nautic.html": "club-nautic.jpg",
    "plaja-olt.html": "plaja-olt.jpg",
    "padel.html": "padel.jpg",
    "stiri.html": "csm-slatina.jpg",
    "stire.html": "csm-slatina.jpg",
    "contact.html": "csm-slatina.jpg",
    "sectii/fotbal-juniori.html": "sectii-fotbal.jpg",
}


def imagine_pentru(rel):
    if rel in IMAGINI:
        return IMAGINI[rel]
    if rel.startswith("sectii/"):
        slug = os.path.basename(rel)[:-5]
        candidat = "sectii-%s.jpg" % slug
        if os.path.exists(os.path.join(SITE, "assets", "img", "og", candidat)):
            return candidat
        return "sectii.jpg"
    return "csm-slatina.jpg"


def pagini():
    for nume in sorted(os.listdir(SITE)):
        if nume.endswith(".html"):
            yield nume
    sectii = os.path.join(SITE, "sectii")
    for nume in sorted(os.listdir(sectii)):
        if nume.endswith(".html"):
            yield "sectii/" + nume


def citeste(cale):
    return io.open(cale, encoding="utf-8").read()


def scrie(cale, text):
    io.open(cale, "w", encoding="utf-8", newline="\n").write(text)


def curata(html):
    """Scoate blocul nostru si tagurile og/twitter/canonical scrise de mana."""
    html = re.sub(re.escape(START) + r".*?" + re.escape(STOP) + r"\n", "", html, flags=re.S)
    html = re.sub(r'[ \t]*<meta property="og:[^>]*>\n', "", html)
    html = re.sub(r'[ \t]*<meta (?:name|property)="twitter:[^>]*>\n', "", html)
    html = re.sub(r'[ \t]*<link rel="canonical"[^>]*>\n', "", html)
    return html


def bloc(rel, titlu, descriere):
    adresa = BAZA_URL + ("" if rel == "index.html" else rel)
    adanc = "../" if rel.startswith("sectii/") else ""
    imagine = BAZA_URL + "assets/img/og/" + imagine_pentru(rel)
    r = [START,
         '  <link rel="canonical" href="%s">' % adresa,
         '  <meta property="og:type" content="website">',
         '  <meta property="og:site_name" content="CSM Slatina">',
         '  <meta property="og:locale" content="ro_RO">',
         '  <meta property="og:url" content="%s">' % adresa,
         '  <meta property="og:title" content="%s">' % titlu,
         '  <meta property="og:description" content="%s">' % descriere,
         '  <meta property="og:image" content="%s">' % imagine,
         '  <meta property="og:image:width" content="1200">',
         '  <meta property="og:image:height" content="630">',
         '  <meta property="og:image:alt" content="%s">' % titlu,
         '  <meta name="twitter:card" content="summary_large_image">',
         '  <meta name="twitter:title" content="%s">' % titlu,
         '  <meta name="twitter:description" content="%s">' % descriere,
         '  <meta name="twitter:image" content="%s">' % imagine,
         STOP]
    if adanc:
        pass
    return "\n".join(r) + "\n"


def main():
    schimbate = 0
    for rel in pagini():
        cale = os.path.join(SITE, rel.replace("/", os.sep))
        html = curata(citeste(cale))

        nume = os.path.basename(rel)
        if nume in INTERNE:
            if 'name="robots"' not in html:
                html = html.replace("</title>", "</title>\n  <meta name=\"robots\" content=\"noindex, nofollow\">", 1)
            scrie(cale, html)
            schimbate += 1
            continue

        m_t = re.search(r"<title>(.*?)</title>", html, re.S)
        m_d = re.search(r'<meta name="description" content="(.*?)"\s*>', html, re.S)
        if not m_t:
            print("fara titlu, sarit:", rel)
            continue
        titlu = " ".join(m_t.group(1).split())
        descriere = " ".join(m_d.group(1).split()) if m_d else titlu

        b = bloc(rel, titlu, descriere)
        if nume in NOINDEX_IN_PLUS and 'name="robots"' not in html:
            b = '  <meta name="robots" content="noindex">\n' + b

        # blocul intra imediat dupa description (sau dupa title, daca lipseste)
        if m_d:
            taietura = m_d.end()
            html = html[:taietura] + "\n" + b.rstrip("\n") + html[taietura:]
        else:
            html = html.replace("</title>", "</title>\n" + b.rstrip("\n"), 1)
        scrie(cale, html)
        schimbate += 1
        print("ok", rel, "->", imagine_pentru(rel))
    print("pagini atinse:", schimbate)


if __name__ == "__main__":
    main()
