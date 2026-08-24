# CSM Slatina — Site oficial

Site-ul Clubului Sportiv Municipal Slatina: 11 secții sportive și Clubul Nautic și de Agrement „Plaja Olt".

**Slatina, oraș al performanței!** · Construim campioni. Inspirăm generații.

## Structură
- `index.html` — pagina principală (hero parallax, secții pe echipă/individuale, despre, Plaja Olt, FAQ, parteneri)
- `sectii/` — paginile celor 11 secții sportive (înotul are layout foto dedicat)
- `padel.html` — terenurile de padel + sistem de rezervare online cu confirmare prin cod SMS
- `admin.html` — panoul de administrare al rezervărilor de padel (acces pe PIN, implicit `2009`)
- `plaja-olt.html` — Clubul Nautic și de Agrement „Plaja Olt"
- `contact.html` — date de contact

## Sistemul de rezervări padel
Rulează momentan în **mod demonstrativ**: codul „SMS" este afișat într-o notificare pe ecran, iar rezervările se salvează în `localStorage` (browserul curent). Pentru producție este nevoie de un backend real:
- trimiterea SMS — punct de integrare în `js/padel-booking.js` (funcția `sendSms`), de conectat la Firebase Phone Auth / Twilio Verify / SMSLink;
- stocarea rezervărilor — punct de integrare în `js/padel-store.js`, de conectat la Firestore / Supabase / API propriu.

## Meciurile din cardul „Calendar"
Cardul din hero afișează automat următorul meci (fotbal sau handbal) din `data/meciuri.json`.
Fișierul se împrospătează rulând:

    python scripts/actualizeaza-meciuri.py

Scriptul citește programul echipelor CSM Slatina de pe Flashscore (fotbal + handbal feminin).
Poate fi pus într-un GitHub Action pe cron pentru actualizare automată.

## Credite foto
Fundalurile estompate ale cardurilor de secții folosesc fotografii proprii ale clubului plus:
- Handbal: „Team Handball Jumpshot 09 USA Nationals" — Wikimedia Commons, licență CC BY-SA 3.0
- Tenis de câmp, Box, Kempo: fotografii Unsplash (licență Unsplash)

## Tehnologii
HTML/CSS/JS static, animații GSAP + ScrollTrigger, fonturi Google (Poppins, Manrope, Barlow Condensed pe pagina de padel). Fără build — se poate servi direct (GitHub Pages).
