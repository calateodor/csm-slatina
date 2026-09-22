/* Fotbal juniori — lotul pe grupe și sosirile recente, din datele FRF.

   Sursa: „Hai la fotbal" (hailafotbal.ro), aplicația oficială FRF, care
   publică toate legitimările și transferurile din fotbalul românesc. Releul
   nostru Cloudflare (/juniori) o citește și întoarce doar sosirile la CSM
   Slatina: legitimări, relegitimări, transferuri și împrumuturi LA noi.
   Plecările nu apar (decizia clubului).

   Lotul de aici e construit din aceste sosiri, deci cuprinde doar copiii
   legitimați sau transferați de când există datele (ianuarie 2026). Când
   clubul trimite lotul complet, îl punem la bază, iar fluxul îl ține la zi.

   Dacă releul nu răspunde, cădem pe copia salvată data/juniori.json. */
(function () {
  "use strict";

  var gazda = document.getElementById("jr-lot");
  if (!gazda) return;

  var RELEU = "https://csm-live.worker-live.workers.dev/juniori";
  var SEZON = 2026;                    // sezonul 2026/2027: U-N = născuți în 2026 − N
  var TIPURI = { 1: "legitimat", 2: "relegitimat", 3: "transferat", 4: "împrumutat" };
  var LUNI = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sept", "oct", "nov", "dec"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function iaJson(adresa) {
    return fetch(adresa).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  // fără diacritice, fără spații duble, cu literă mică — pentru potriviri de nume
  function plat(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  }
  // FRF scrie „Familie Prenume Al Doilea"; noi arătăm „Prenume Familie"
  function parti(nume) {
    var v = String(nume || "").trim().split(/\s+/);
    return { familie: v[0] || "", prenume: v.slice(1).join(" ") };
  }
  function dataScurta(iso) {
    var d = new Date(iso + "T12:00:00");
    return isNaN(d) ? "" : d.getDate() + " " + LUNI[d.getMonth()] + " " + d.getFullYear();
  }

  /* Grupa din anul nașterii. Băieții au grupe an cu an, de la U10 la U19;
     fetele au două echipe, U15 (născute 2011–2012) și U13 (2013–2014).
     Cine e mai mic decât grupele astea intră la „Inițiere". */
  function grupa(j) {
    var u = SEZON - j.an;
    if (j.gen === "F") return u >= 14 ? "U15 Fete" : (u >= 12 ? "U13 Fete" : "Inițiere Fete");
    if (u < 10) return "Inițiere";
    return "U" + u;
  }
  var ORDINE = { "Inițiere": 0, "Inițiere Fete": 100, "U13 Fete": 101, "U15 Fete": 102 };
  function ordineGrupa(g) {
    return g in ORDINE ? ORDINE[g] : parseInt(g.slice(1), 10);
  }
  function descriereGrupa(g, lista) {
    var ani = lista.map(function (j) { return j.an; });
    var min = Math.min.apply(null, ani), max = Math.max.apply(null, ani);
    var nascuti = lista[0].gen === "F" ? "născute" : "născuți";
    return nascuti + " " + (min === max ? min : min + "–" + max);
  }
  function numarJucatori(lista) {
    var f = lista[0].gen === "F";
    return lista.length + (lista.length === 1 ? (f ? " jucătoare" : " jucător") : (f ? " jucătoare" : " jucători"));
  }

  /* Cine e deja în lotul de seniori nu e junior, chiar dacă FRF îl pune la
     juniori după vârstă. Potrivim după familie + primul prenume. */
  function cheieSenior(nume) {
    var v = plat(nume).split(" ");
    return v.length ? v[0] + " " + (v[1] || "") : "";
  }

  function card(j) {
    var p = parti(j.nume);
    var det = TIPURI[j.tip] || "";
    if (j.dinClub && (j.tip === 3 || j.tip === 4)) det += " de la " + j.dinClub;
    return '<article class="jl-card">' +
      '<span class="jl-poza">' +
        (j.poza ? '<img src="' + esc(j.poza) + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'gol\'); this.remove()">' : "") +
        '<i class="jl-initiale" aria-hidden="true">' + esc((p.prenume[0] || "") + (p.familie[0] || "")) + "</i>" +
      "</span>" +
      '<span class="jl-nume"><small>' + esc(p.prenume) + "</small><b>" + esc(p.familie) + "</b></span>" +
      '<span class="jl-det" title="' + esc(det) + '">' + esc(det) + "</span>" +
      "</article>";
  }

  function deseneaza(jucatori, meta) {
    var grupe = {};
    jucatori.forEach(function (j) {
      var g = grupa(j);
      (grupe[g] = grupe[g] || []).push(j);
    });
    var nume = Object.keys(grupe).sort(function (a, b) { return ordineGrupa(a) - ordineGrupa(b); });
    var h = "";
    nume.forEach(function (g) {
      var lista = grupe[g].slice().sort(function (a, b) { return plat(a.nume) < plat(b.nume) ? -1 : 1; });
      h += '<section class="jl-grupa' + (/Fete/.test(g) ? " fete" : "") + '">' +
        '<h3><b>' + esc(g) + "</b><span>" + esc(descriereGrupa(g, lista)) + " · " + numarJucatori(lista) + "</span></h3>" +
        '<div class="jl-carduri">' + lista.map(card).join("") + "</div></section>";
    });

    // sosirile cele mai noi, ca flux
    var recente = jucatori.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 8);
    h += '<section class="jl-sosiri"><h3><b>Sosiri recente</b><span>ultimele mișcări de lot</span></h3><ul>' +
      recente.map(function (j) {
        var p = parti(j.nume);
        return "<li><time>" + esc(dataScurta(j.data)) + "</time>" +
          "<b>" + esc(p.prenume + " " + p.familie) + "</b>" +
          "<span>" + esc(grupa(j)) + " · " + esc(TIPURI[j.tip] || "") +
          (j.dinClub && (j.tip === 3 || j.tip === 4) ? " de la " + esc(j.dinClub) : "") + "</span></li>";
      }).join("") + "</ul></section>";

    h += '<p class="jl-sursa">' + jucatori.length + " de juniori sosiți din ianuarie 2026 · date " +
      (meta && meta.sursa ? esc(meta.sursa) : "FRF, Hai la fotbal") +
      (meta && meta.luatLa ? ", actualizate automat" : "") + "</p>";
    gazda.innerHTML = h;
  }

  Promise.all([
    iaJson(RELEU).then(function (d) {
      if (!d || d.eroare || !d.jucatori || !d.jucatori.length) throw new Error("releu gol");
      return d;
    }).catch(function () { return iaJson("../data/juniori.json"); }),
    iaJson("../data/lot-fotbal.json").catch(function () { return { jucatori: [] }; }),
    // ajustări făcute de club: un copil ascuns la cererea părinților, o poză
    // scoasă (de exemplu un scan de legitimație în loc de portret)
    iaJson("../data/juniori-ajustari.json").catch(function () { return {}; })
  ]).then(function (p) {
    var seniori = {};
    (p[1].jucatori || []).forEach(function (s) { seniori[cheieSenior(s.nume)] = true; });
    var ascunsi = p[2].ascunde || [], faraPoza = p[2].faraPoza || [];
    var juniori = (p[0].jucatori || []).filter(function (j) {
      return j.an >= SEZON - 19 && !seniori[cheieSenior(j.nume)] && ascunsi.indexOf(j.id) < 0;
    }).map(function (j) {
      return faraPoza.indexOf(j.id) < 0 ? j : Object.assign({}, j, { poza: null });
    });
    if (!juniori.length) throw new Error("fără juniori");
    deseneaza(juniori, p[0]);
  }).catch(function () {
    gazda.innerHTML = '<p class="jl-sursa">Lotul de juniori se încarcă din datele FRF; momentan nu sunt disponibile.</p>';
  });
})();
