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

// numele echipei, curățat de sufixul „ F" pe care Flashscore îl pune femininelor
function curata(nume) {
  return (nume || "").replace(/\s+F$/, "");
}

function parseazaMeciuri(text) {
  // înregistrările încep cu AA÷ și au câmpuri cheie÷valoare despărțite de ¬
  const blocuri = text.match(/AA÷[^~]*(?:¬[A-Z]{1,3}÷[^¬~]*)*/g) || [];
  const meciuri = new Map(); // dedup după id: fiecare meci apare de două ori în pagină
  for (const b of blocuri) {
    const c = {};
    for (const p of b.split("¬")) {
      const i = p.indexOf("÷");
      if (i > 0) c[p.slice(0, i)] = p.slice(i + 1);
    }
    if (c.AA && c.AD) meciuri.set(c.AA, c);
  }
  return [...meciuri.values()];
}

function meciulZilei(meciuri, acum) {
  // meciul „relevant": a început în ultimele 6 ore sau începe în următoarele 12
  let ales = null;
  for (const m of meciuri) {
    const start = Number(m.AD) * 1000;
    if (start > acum - 6 * 3600e3 && start < acum + 12 * 3600e3) {
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

async function iaEchipa(sport, id) {
  const r = await fetch(`https://www.flashscore.ro/echipa/csm-slatina/${id}/meciuri/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "ro-RO,ro;q=0.9",
    },
    cf: { cacheTtl: 8, cacheEverything: true },
  });
  if (!r.ok) return { eroare: `flashscore ${r.status}` };
  return meciulZilei(parseazaMeciuri(await r.text()), Date.now());
}

export default {
  async fetch(cerere, env, ctx) {
    const cache = caches.default;
    const cheie = new Request(new URL(cerere.url).origin + "/live", cerere);
    const dinCache = await cache.match(cheie);
    if (dinCache) return dinCache;

    const [fotbal, handbal] = await Promise.all([
      iaEchipa("fotbal", ECHIPE.fotbal).catch((e) => ({ eroare: String(e) })),
      iaEchipa("handbal", ECHIPE.handbal).catch((e) => ({ eroare: String(e) })),
    ]);

    const raspuns = new Response(
      JSON.stringify({ fotbal, handbal, luatLa: Math.floor(Date.now() / 1000) }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=10",
        },
      }
    );
    ctx.waitUntil(cache.put(cheie, raspuns.clone()));
    return raspuns;
  },
};
