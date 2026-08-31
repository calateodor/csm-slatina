/* Știri & Calendar — hubul editorial.
   Știrile vin din data/stiri.json (editabil din panoul de administrare).
   Meciurile și rezultatele vin din releul Cloudflare, care citește Flashscore
   în timp real, cu data/meciuri.json + data/echipe.json ca rezervă dacă releul
   nu răspunde. Peste orice sursă se aplică suprascrierile din panou. */
(function () {
  "use strict";

  var LUNI = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.",
              "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

  function dataFrumoasa(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + LUNI[parseInt(p[1], 10) - 1].replace(".", "") + " " + p[0];
  }
  function dataOra(ts) {
    var d = new Date(ts * 1000);
    return ("0" + d.getDate()).slice(-2) + " " + LUNI[d.getMonth()] + " " + d.getFullYear() +
           " · " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var vedereStiri = document.getElementById("vedere-stiri");
  var vedereCal = document.getElementById("vedere-calendar");
  if (!vedereStiri) return;

  /* ---------- comutatorul de vederi ---------- */
  document.querySelectorAll(".stiri-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".stiri-tab").forEach(function (t) { t.classList.remove("activ"); });
      tab.classList.add("activ");
      var cal = tab.dataset.vedere === "calendar";
      vedereStiri.hidden = cal;
      vedereCal.hidden = !cal;
    });
  });

  /* ---------- știrile ---------- */
  var toateStirile = [];
  var categorii = {};

  function deseneazaStiri(filtru) {
    var grila = document.getElementById("stiri-grila");
    var vizibile = toateStirile.filter(function (s) {
      return s.publicat !== false && (filtru === "toate" || s.categorie === filtru);
    });
    if (!vizibile.length) {
      grila.innerHTML = '<p class="stiri-gol">Nicio știre în această categorie — deocamdată.</p>';
      return;
    }
    grila.innerHTML = vizibile.map(function (s) {
      var media = s.poza
        ? '<img src="' + esc(s.poza) + '" alt="" loading="lazy">'
        : '<img class="stema" src="assets/img/logo.png" alt="">';
      return '<a class="stire-card" href="stire.html?s=' + encodeURIComponent(s.slug) + '">' +
        '<span class="stire-media">' + media +
        '<span class="stire-badge">' + esc(categorii[s.categorie] || s.categorie) + "</span></span>" +
        '<span class="stire-continut">' +
        '<span class="stire-data">' + dataFrumoasa(s.data) + "</span>" +
        "<h3>" + esc(s.titlu) + "</h3>" +
        "<p>" + esc(s.rezumat) + "</p>" +
        '<span class="stire-link">Citește articolul →</span>' +
        "</span></a>";
    }).join("");
  }

  fetch("data/stiri.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (date) {
      categorii = date.categorii || {};
      toateStirile = (date.stiri || []).slice().sort(function (a, b) {
        return a.data < b.data ? 1 : -1;
      });
      // cipurile de filtrare, din categoriile existente
      var filtre = document.getElementById("stiri-filtre");
      var h = '<button class="stiri-cip activ" data-filtru="toate">Toate</button>';
      Object.keys(categorii).forEach(function (c) {
        h += '<button class="stiri-cip" data-filtru="' + c + '">' + esc(categorii[c]) + "</button>";
      });
      filtre.innerHTML = h;
      filtre.querySelectorAll(".stiri-cip").forEach(function (cip) {
        cip.addEventListener("click", function () {
          filtre.querySelectorAll(".stiri-cip").forEach(function (x) { x.classList.remove("activ"); });
          cip.classList.add("activ");
          deseneazaStiri(cip.dataset.filtru);
        });
      });
      deseneazaStiri("toate");
    });

  /* ---------- calendarul ---------- */
  var meciuri = [];
  var rezultate = [];

  function eAcasa(m) { return /^CSM Slatina/i.test(m.gazde || ""); }

  /* Releul întoarce sportul cu majusculă („Fotbal"), fișierele statice cu
     literă mică („fotbal"), iar cipurile de filtrare folosesc varianta mică.
     Îl păstrăm mereu mic în date și îl scriem frumos doar la afișare. */
  function micSport(s) { return String(s || "").toLowerCase(); }
  function numeSport(s) { return micSport(s) === "handbal" ? "Handbal" : "Fotbal"; }

  /* Un meci rămâne în calendar toată ziua în care se joacă și dispare la
     miezul nopții — aceeași regulă cu banda de scor live, ca cele două să nu
     spună lucruri diferite în același moment. Pragul se recalculează la
     fiecare desenare, nu o dată la încărcarea paginii: un tab lăsat deschis
     peste noapte trebuie să se cureţe singur la următorul click pe filtru. */
  function miezulNoptii() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  }

  function deseneazaCalendar(filtru) {
    var lista = document.getElementById("cal-lista");
    var prag = miezulNoptii();
    var viitoare = meciuri.filter(function (m) {
      if (filtru !== "toate" && (m.sport || "").toLowerCase() !== filtru) return false;
      return m.timestamp >= prag;
    });
    lista.innerHTML = viitoare.length ? viitoare.map(function (m) {
      var acasa = eAcasa(m);
      return '<div class="cal-meci">' +
        '<span class="cal-sport">' + esc(numeSport(m.sport)) + "</span>" +
        '<span class="cal-detalii"><strong>' + esc(m.gazde) + " vs " + esc(m.oaspeti) + "</strong>" +
        "<span>" + esc(m.competitie) + " · " + dataOra(m.timestamp) + "</span></span>" +
        '<span class="cal-unde ' + (acasa ? "acasa" : "deplasare") + '">' +
        (acasa ? "Acasă" : "Deplasare") + "</span></div>";
    }).join("") : '<p class="stiri-gol">Niciun meci programat pe acest filtru.</p>';

    var rez = document.getElementById("cal-rezultate");
    var vizibile = rezultate.filter(function (r) {
      return filtru === "toate" || micSport(r.sport) === filtru;
    });
    rez.innerHTML = vizibile.map(function (r) {
      var scor = (r.scor && r.scor.length === 2) ? r.scor[0] + " – " + r.scor[1] : "— : —";
      var cls = r.forma === "V" ? "forma-v" : (r.forma === "Î" ? "forma-i" : "");
      return '<div class="cal-rez-rand">' +
        '<span class="cal-rez-meta">' + esc(numeSport(r.sport)) +
        " · " + esc(r.competitie) + " · " + dataOra(r.timestamp) + "</span>" +
        "<b>" + esc(r.gazde) + ' <span class="scor ' + cls + '">' + scor + "</span> " + esc(r.oaspeti) + "</b>" +
        "</div>";
    }).join("");
  }

  /* Sursa calendarului.
     Întâi releul Cloudflare, care citește Flashscore în timp real: fișierele
     din data/ se regenerează doar când rulează cineva scriptul, așa că se
     învecheau — meciuri deja jucate rămâneau „viitoare", iar reprogramările
     nu apăreau deloc. Dacă releul nu răspunde, cădem pe fișierele statice,
     ca pagina să nu rămână goală. */
  var RELEU = "https://csm-live.worker-live.workers.dev/calendar";

  function iaJson(adresa) {
    return fetch(adresa).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  /* Suprascrierile din panoul de administrare au ultimul cuvânt, indiferent de
     unde vin meciurile: unul marcat „șters" dispare, unul editat păstrează
     valorile puse de administrator, iar cele adăugate de mână (manual-*) se
     adaugă la listă. Aceeași regulă ca în scripts/actualizeaza-meciuri.py —
     altfel, mutând calendarul pe releu, editările din panou ar fi ignorate
     în tăcere. */
  function aplicaSuprascrieri(lista, supra) {
    if (!supra) return lista;
    var iesire = [];
    lista.forEach(function (m) {
      var regula = supra[m.flashscoreId];
      if (regula === "sters") return;
      iesire.push(regula && typeof regula === "object" ? Object.assign({}, m, regula) : m);
    });
    Object.keys(supra).forEach(function (cheie) {
      if (cheie.indexOf("manual-") === 0 && supra[cheie] && typeof supra[cheie] === "object") {
        iesire.push(supra[cheie]);
      }
    });
    return iesire.sort(function (a, b) { return a.timestamp - b.timestamp; });
  }

  function dinStatic() {
    return Promise.all([
      iaJson("data/meciuri.json?v=" + Date.now()),
      iaJson("data/echipe.json?v=" + Date.now())
    ]).then(function (perechi) {
      var rez = [];
      var e = perechi[1];
      ["fotbal", "handbal"].forEach(function (sp) {
        ((e[sp] || {}).rezultate || []).forEach(function (r) {
          rez.push(Object.assign({ sport: sp }, r));
        });
      });
      return { meciuri: perechi[0].meciuri || [], rezultate: rez };
    });
  }

  Promise.all([
    iaJson(RELEU).then(function (d) {
      // un releu care răspunde, dar cu ambele echipe picate, nu e o sursă bună
      if (!d.meciuri || (!d.meciuri.length && !(d.rezultate || []).length)) throw new Error("gol");
      return d;
    }).catch(dinStatic),
    iaJson("data/suprascrieri.json?v=" + Date.now()).catch(function () { return {}; })
  ]).then(function (perechi) {
    var d = perechi[0];
    meciuri = aplicaSuprascrieri(
      (d.meciuri || []).slice().sort(function (a, b) { return a.timestamp - b.timestamp; }),
      (perechi[1] || {}).meciuri
    );
    rezultate = (d.rezultate || []).slice().sort(function (a, b) { return b.timestamp - a.timestamp; });

    var filtre = document.getElementById("cal-filtre");
    filtre.querySelectorAll(".stiri-cip").forEach(function (cip) {
      cip.addEventListener("click", function () {
        filtre.querySelectorAll(".stiri-cip").forEach(function (x) { x.classList.remove("activ"); });
        cip.classList.add("activ");
        deseneazaCalendar(cip.dataset.filtru);
      });
    });
    deseneazaCalendar("toate");
  });
})();
