# -*- coding: utf-8 -*-
"""Ștampilează link-urile către CSS și JS din paginile HTML cu un „?v=<hash>"
calculat din conținutul fișierului, ca browserele (mai ales cele de pe
telefon, care țin fișierele zile întregi) să ia varianta nouă imediat ce
un fișier s-a schimbat. Adresa se schimbă doar când se schimbă conținutul.

Rulare din rădăcina repo-ului:  python scripts/versiuni.py
Se rulează și în GitHub Actions înainte de urcarea pe csmslatina.ro."""
import hashlib, io, os, re, sys

RADACINA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v4')
TIPAR = re.compile(r'(?P<atr>\b(?:href|src)=")(?P<cale>(?:\.\./)*(?:css|js)/[A-Za-z0-9_./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"')

def hash_fisier(cale):
    with open(cale, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]

def main():
    schimbate = 0
    lipsa = set()
    for dosar, _, fisiere in os.walk(RADACINA):
        for nume in fisiere:
            if not nume.endswith('.html'):
                continue
            cale_html = os.path.join(dosar, nume)
            text = io.open(cale_html, encoding='utf-8').read()

            def inlocuire(m):
                tinta = os.path.normpath(os.path.join(dosar, m.group('cale')))
                if not os.path.isfile(tinta):
                    lipsa.add(m.group('cale'))
                    return m.group(0)
                return '%s%s?v=%s"' % (m.group('atr'), m.group('cale'), hash_fisier(tinta))

            nou = TIPAR.sub(inlocuire, text)
            if nou != text:
                io.open(cale_html, 'w', encoding='utf-8', newline='\n').write(nou)
                schimbate += 1
    print('versiuni: %d pagini actualizate' % schimbate)
    if lipsa:
        print('ATENTIE, fisiere lipsa: ' + ', '.join(sorted(lipsa)), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
