/* Știri & Calendar — hubul editorial.
   Știrile vin din data/stiri.json (editabil din panoul de administrare),
   meciurile din data/meciuri.json + data/echipe.json (actualizate automat
   de scripturile Flashscore, cu suprascrieri manuale din panou). */
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

  function deseneazaCalendar(filtru) {
    var lista = document.getElementById("cal-lista");
    var viitoare = meciuri.filter(function (m) {
      if (filtru !== "toate" && (m.sport || "").toLowerCase() !== filtru) return false;
      return true;
    });
    lista.innerHTML = viitoare.length ? viitoare.map(function (m) {
      var acasa = eAcasa(m);
      return '<div class="cal-meci">' +
        '<span class="cal-sport">' + esc(m.sport) + "</span>" +
        '<span class="cal-detalii"><strong>' + esc(m.gazde) + " vs " + esc(m.oaspeti) + "</strong>" +
        "<span>" + esc(m.competitie) + " · " + dataOra(m.timestamp) + "</span></span>" +
        '<span class="cal-unde ' + (acasa ? "acasa" : "deplasare") + '">' +
        (acasa ? "Acasă" : "Deplasare") + "</span></div>";
    }).join("") : '<p class="stiri-gol">Niciun meci programat pe acest filtru.</p>';

    var rez = document.getElementById("cal-rezultate");
    var vizibile = rezultate.filter(function (r) {
      return filtru === "toate" || r.sport === filtru;
    });
    rez.innerHTML = vizibile.map(function (r) {
      var scor = (r.scor && r.scor.length === 2) ? r.scor[0] + " – " + r.scor[1] : "— : —";
      var cls = r.forma === "V" ? "forma-v" : (r.forma === "Î" ? "forma-i" : "");
      return '<div class="cal-rez-rand">' +
        '<span class="cal-rez-meta">' + esc(r.sport === "fotbal" ? "Fotbal" : "Handbal") +
        " · " + esc(r.competitie) + " · " + dataOra(r.timestamp) + "</span>" +
        "<b>" + esc(r.gazde) + ' <span class="scor ' + cls + '">' + scor + "</span> " + esc(r.oaspeti) + "</b>" +
        "</div>";
    }).join("");
  }

  Promise.all([
    fetch("data/meciuri.json?v=" + Date.now()).then(function (r) { return r.json(); }),
    fetch("data/echipe.json?v=" + Date.now()).then(function (r) { return r.json(); })
  ]).then(function (perechi) {
    meciuri = (perechi[0].meciuri || []).slice().sort(function (a, b) { return a.timestamp - b.timestamp; });
    var e = perechi[1];
    ["fotbal", "handbal"].forEach(function (sp) {
      ((e[sp] || {}).rezultate || []).forEach(function (r) {
        var c = Object.assign({ sport: sp }, r);
        rezultate.push(c);
      });
    });
    rezultate.sort(function (a, b) { return b.timestamp - a.timestamp; });

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
