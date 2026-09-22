# -*- coding: utf-8 -*-
"""Reface copia de siguranță data/juniori.json din releul Cloudflare (/juniori),
care citește datele FRF („Hai la fotbal") pentru sosirile de juniori la CSM
Slatina. Site-ul citește releul direct; fișierul e folosit doar dacă releul
nu răspunde, deci merită reîmprospătat din când în când.

Rulare (din rădăcina repo-ului):
    python v4/scripts/actualizeaza-juniori.py
"""
import io, json, os, sys, time, urllib.request

RELEU = "https://csm-live.worker-live.workers.dev/juniori"

def main():
    req = urllib.request.Request(RELEU, headers={"User-Agent": "csmslatina.ro/actualizeaza-juniori"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if d.get("eroare") or not d.get("jucatori"):
        print("Releul n-a întors juniori:", d.get("eroare", "listă goală"), file=sys.stderr)
        return 1
    radacina = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cale = os.path.join(radacina, "data", "juniori.json")
    out = {
        "_comentariu": "Copie de siguranță a sosirilor de juniori la CSM Slatina, din datele FRF (Hai la fotbal). Site-ul citește întâi releul Cloudflare (/juniori); fișierul ăsta e folosit doar dacă releul nu răspunde. Se reface cu v4/scripts/actualizeaza-juniori.py.",
        "sursa": d.get("sursa", "FRF · Hai la fotbal"),
        "luatLa": time.strftime("%Y-%m-%d"),
        "jucatori": d["jucatori"],
    }
    io.open(cale, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print("scris:", cale, "(%d sosiri)" % len(d["jucatori"]))
    return 0

if __name__ == "__main__":
    sys.exit(main())
