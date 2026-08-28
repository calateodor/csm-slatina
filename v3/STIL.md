# Identitatea vizuală CSM Slatina — v3

Deciziile de stil stabilite cu Teo (sesiunea de identitate + completările v3).
Oglinda vizuală a acestui document e proiectul „CSM Slatina" de pe claude.ai/design.
Site-ul (codul) rămâne sursa adevărului; documentul e harta.

## Cele patru fundații

**1. Registrele (hibrid pe roluri).** Rolul paginii alege registrul, limbajul
rămâne același peste tot:
- **Club** (secțiile sportive: fotbal, kempo, box…): albastru instituțional +
  foi albe. Oficial, curat.
- **Agrement** (Clubul Nautic): întunecat, imersiv, capitole cu fundaluri foto.
- **Plaja** (pagina nouă, separată de nautic): luminoasă, de vară — cer, apă,
  nisip. Singura pagină de agrement în registru deschis.

**2. Ritmul secțiunilor: plin ↔ chenar.** Secțiunile alternează între „plin"
(fundal din margine în margine, cu cuvântul-fantomă animat) și „chenar" (panou
rotunjit pe fond deschis). Muchii drepte între ele. Raze standard:
`--raza-panou: 24px`, `--raza-card: 14px`. Conținutul secțiunilor pline se
poate lărgi la `--container-lat: 1400px`. Pe fotbal: hero(plin) → Sezonul
(chenar) → Lotul(plin) → Despre(chenar deschis) → banner(plin).

**3. Cuvântul-fantomă.** Poppins 800, uriaș, 4–7% opacitate, pe ORICE
secțiune-cheie, întotdeauna animat la scroll (clasa `.fantoma` + main.js).
Niciodată static.

**4. Auriul (#f6c81c).** Pe club: strict funcțional — prețuri, butonul
principal, eyebrow, un cuvânt-accent în titlu; niciodată decorativ. Pe
agrement: generos — și muchii, fire luminoase, panouri cu tentă aurie.
Pe fundal deschis prețurile trec pe #dfae00.

## Standarde de componente

- **Eroul secțiilor simple**: fotografie reală + filtrul albastru (rețeta:
  saturate .6 · brightness .66 · blur 2px, tentă #2a5298 mix-blend color .82,
  văl bleumarin). Fără poză → rămâne gradientul; nimic fals.
- **Eroul-calendar** (wallpaper cu echipa + calendarul lunii): fotbal azi;
  handbalul primește fratele lui mai târziu (decupaje din green screen).
- **Tarifele**: rândul cu puncte de umplutură și preț auriu — standardul de
  prețuri pe TOT site-ul, adaptat cromatic pe registru.
- **Cardurile-acordeon** verticale: exclusivitatea paginii de nautic.
- **Galerie + lightbox**: pe toate secțiile; grilă mozaic la 5+ poze; o galerie
  goală își ascunde singură secțiunea.
- **Mișcarea**: semnăturile de bază peste tot (fantome animate + reveal-uri);
  povestea complexă cu straturi rămâne pe paginile-far (fotbal, handbal,
  nautic, plaja). Curbele standard: `--ease-out`, `--ease-in-out` din style.css.
- **Praful de stele** (js/stele.js): fundalul secțiunilor pline — WebGL,
  atracție blândă spre cursor, parallax la scroll. Manete în PARAMETRI.

## Despărțirea Plaja Olt / Clubul Nautic

- Două pagini, două intrări separate în meniu.
- **Plaja Olt** (nouă, registru luminos): acces + șezlong + piscină,
  petrecerile pe plajă, program și regulament.
- **Clubul Nautic** (actualul plaja-olt.html): serviciile — padel, tenis,
  caiac, saună, masaj, frizerie…
- Cross-promo: capitol-teaser cu 2–3 carduri pe fiecare pagină, spre cealaltă
  („În aceeași incintă").

## Conținut

- Clubul nu are motto cu „alb-albaștrii"/„albastru-alb" — nu inventăm sloganuri.
- Creditul AI pe portretele lotului nu se afișează (datele rămân în
  echipe.json → pozaCredit).
