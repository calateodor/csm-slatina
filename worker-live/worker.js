/* Releu de scor live pentru site-ul CSM Slatina.
   Browserul vizitatorului nu are voie să citească flashscore.ro direct
   (CORS), așa că worker-ul ăsta gratuit face cererea în locul lui:
   ia pagina de meciuri a fiecărei echipe, alege meciul zilei și întoarce
   un JSON mic. Răspunsul stă 10 secunde în cache-ul Cloudflare, deci
   oricâți vizitatori am avea, Flashscore e întrebat de cel mult ~6 ori
   pe minut. */

const ECHIPE = {
  fotbal: "zRqy53ur",
  handbal: "ptT2ffej",
};

/* Numele echipei, curățat de decorațiile Flashscore: sufixul de țară „(Rou)"
   care apare pe unele înregistrări și „ F"-ul pus echipelor feminine. Ordinea
   contează — țara se scoate prima, altfel „CSM Slatina F (Rou)" nu s-ar
   potrivi cu tiparul de „ F" de la final. */
function curata(nume) {
  return (nume || "")
    .replace(/\s*\([A-Za-z]{3}\)\s*$/, "")
    .replace(/\s+F$/, "")
    .trim();
}

/* Feed-ul e o listă de înregistrări despărțite prin «~», cu câmpuri «¬» și
   perechi cheie÷valoare. Îl parcurgem în ORDINE, nu cu o expresie regulată pe
   blocurile de meci: numele competiției stă în câmpul ZK al unui antet care
   precede grupul lui de meciuri, deci ordinea e singura care îl leagă de ele.
   (Aceeași logică din scripts/actualizeaza-meciuri.py.) */
function parseazaMeciuri(text) {
  const meciuri = new Map(); // dedup după id: fiecare meci apare de două ori în pagină
  let liga = "";
  for (const rec of text.split("~")) {
    const c = {};
    for (const p of rec.split("¬")) {
      const i = p.indexOf("÷");
      if (i > 0) c[p.slice(0, i)] = p.slice(i + 1);
    }
    if (c.ZK) liga = c.ZK;                // antet de competiție
    if (c.AA && c.AD && c.AE && c.AF && !meciuri.has(c.AA)) {
      c.__liga = liga;
      meciuri.set(c.AA, c);
    }
  }
  return [...meciuri.values()];
}

// forma unui meci încheiat din perspectiva noastră: V / E / Î
function forma(gazde, sg, sa) {
  if (sg == null || sa == null) return "";
  const noi = /csm\s*slatina/i.test(gazde);
  const ale = Number(noi ? sg : sa);
  const lor = Number(noi ? sa : sg);
  if (!Number.isFinite(ale) || !Number.isFinite(lor)) return "";
  return ale > lor ? "V" : (ale < lor ? "Î" : "E");
}

/* Lista completă a unei echipe: ce urmează și ce s-a jucat deja.
   AB: 1 = programat, 2 = în desfășurare, 3 = încheiat. */
function listaEchipei(meciuri, sport, sursa) {
  const viitoare = [];
  const rezultate = [];
  for (const m of meciuri) {
    const baza = {
      sport,
      competitie: m.__liga || "",
      timestamp: Number(m.AD),
      gazde: curata(m.AE),
      oaspeti: curata(m.AF),
      flashscoreId: m.AA,
      sursa,
    };
    const stare = Number(m.AB) || 1;
    if (stare === 3) {
      const sg = m.AG ?? null, sa = m.AH ?? null;
      rezultate.push({ ...baza, scor: [sg, sa], forma: forma(m.AE, sg, sa) });
    } else {
      viitoare.push(baza);
    }
  }
  viitoare.sort((a, b) => a.timestamp - b.timestamp);
  rezultate.sort((a, b) => b.timestamp - a.timestamp);
  /* Pagina de echipă ține tot sezonul (zeci de meciuri) și tot istoricul.
     Trimitem doar cât se afișează: următoarele 12 și ultimele 12 pe sport.
     Fără plafon, răspunsul ajungea la ~19 KB pentru o listă din care se vedeau
     oricum primele rânduri. */
  return { viitoare: viitoare.slice(0, 12), rezultate: rezultate.slice(0, 12) };
}

function meciulZilei(meciuri, acum) {
  // meciul „relevant": a început în ultimele 6 ore sau începe în următoarele
  // 48 — fereastra largă acoperă bannerul „mâine e meciul" de pe site
  let ales = null;
  for (const m of meciuri) {
    const start = Number(m.AD) * 1000;
    if (start > acum - 6 * 3600e3 && start < acum + 48 * 3600e3) {
      if (!ales || Math.abs(start - acum) < Math.abs(Number(ales.AD) * 1000 - acum)) ales = m;
    }
  }
  if (!ales) return null;
  return {
    id: ales.AA,
    start: Number(ales.AD),
    stare: Number(ales.AB) || 1,   // 1 = programat, 2 = în desfășurare, 3 = încheiat
    faza: Number(ales.AC) || 0,    // codul fazei Flashscore (repriză/pauză/final)
    gazde: curata(ales.AE),
    oaspeti: curata(ales.AF),
    scorGazde: ales.AG ?? null,
    scorOaspeti: ales.AH ?? null,
    pauzaGazde: ales.BC ?? null,   // scorul la pauză
    pauzaOaspeti: ales.BD ?? null,
  };
}

const ADRESA_ECHIPA = (id) => `https://www.flashscore.ro/echipa/csm-slatina/${id}/meciuri/`;

async function paginaEchipei(id, ttl) {
  const r = await fetch(ADRESA_ECHIPA(id), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "ro-RO,ro;q=0.9",
    },
    cf: { cacheTtl: ttl, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`flashscore ${r.status}`);
  return parseazaMeciuri(await r.text());
}

async function iaEchipa(sport, id) {
  try {
    return meciulZilei(await paginaEchipei(id, 8), Date.now());
  } catch (e) {
    return { eroare: String(e.message || e) };
  }
}

async function iaCalendarul(sport, id) {
  try {
    return listaEchipei(await paginaEchipei(id, 300), sport, ADRESA_ECHIPA(id));
  } catch (e) {
    return { eroare: String(e.message || e), viitoare: [], rezultate: [] };
  }
}

function json(corp, secunde) {
  return new Response(JSON.stringify(corp), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${secunde}`,
    },
  });
}

export default {
  async fetch(cerere, env, ctx) {
    const url = new URL(cerere.url);
    // Ruta rădăcină rămâne exact cum era: de ea depinde banda de scor live.
    // Calendarul stă pe /calendar, cu cheie de cache proprie — altfel cele
    // două răspunsuri, de forme complet diferite, s-ar suprascrie în cache.
    const calendar = url.pathname === "/calendar";
    const cache = caches.default;
    const cheie = new Request(url.origin + (calendar ? "/c-calendar" : "/live"), cerere);
    const dinCache = await cache.match(cheie);
    if (dinCache) return dinCache;

    let raspuns;
    if (calendar) {
      const [fotbal, handbal] = await Promise.all([
        iaCalendarul("Fotbal", ECHIPE.fotbal),
        iaCalendarul("Handbal", ECHIPE.handbal),
      ]);
      // o listă unică, ordonată, ca site-ul să nu mai lipească nimic
      const viitoare = [...(fotbal.viitoare || []), ...(handbal.viitoare || [])]
        .sort((a, b) => a.timestamp - b.timestamp);
      const rezultate = [...(fotbal.rezultate || []), ...(handbal.rezultate || [])]
        .sort((a, b) => b.timestamp - a.timestamp);
      raspuns = json(
        {
          meciuri: viitoare,
          rezultate,
          erori: [fotbal.eroare, handbal.eroare].filter(Boolean),
          luatLa: Math.floor(Date.now() / 1000),
        },
        // calendarul nu se schimbă de la o secundă la alta; 5 minute e destul
        // de proaspăt și ține Flashscore-ul întrebat rar
        300
      );
    } else {
      const [fotbal, handbal] = await Promise.all([
        iaEchipa("fotbal", ECHIPE.fotbal).catch((e) => ({ eroare: String(e) })),
        iaEchipa("handbal", ECHIPE.handbal).catch((e) => ({ eroare: String(e) })),
      ]);
      raspuns = json({ fotbal, handbal, luatLa: Math.floor(Date.now() / 1000) }, 10);
    }

    ctx.waitUntil(cache.put(cheie, raspuns.clone()));
    return raspuns;
  },
};
