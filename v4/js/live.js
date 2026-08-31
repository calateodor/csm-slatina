/* =========================================================
   CSM Slatina — banda de scor LIVE
   ---------------------------------------------------------
   Citește releul Cloudflare (worker-live) la fiecare 15 s și
   arată, sub antet, meciul zilei: minutul care curge, scorul,
   pauza (cu scorul de la pauză) și scorul final — care rămâne
   afișat până la miezul nopții. Fără meci azi, banda nu există.

   Pe prima pagină fotbalul are prioritate; pagina de fotbal
   arată doar fotbal, cea de handbal doar handbal (atributul
   data-live-sport de pe <body>).
   ========================================================= */
(function () {
  "use strict";

  var ADRESA = "https://csm-live.worker-live.workers.dev/";
  var INTERVAL = 15000;

  var sportCerut = document.body.getAttribute("data-live-sport") || "auto";
  var banda = null;
  var stare = null;         // ultimul răspuns ales pentru afișare
  var cronometru = null;

  /* durata reprizei și pauza estimată, pe sport (minute) */
  var REGULI = {
    fotbal: { repriza: 45, pauza: 15 },
    handbal: { repriza: 30, pauza: 10 }
  };

  function alege(date) {
    // ce meci arătăm pe pagina asta?
    var candidati = sportCerut === "auto"
      ? ["fotbal", "handbal"]                  // prioritatea lui Teo: fotbalul întâi
      : [sportCerut];
    var alesul = null;
    for (var i = 0; i < candidati.length; i++) {
      var s = candidati[i];
      var m = date[s];
      if (!m || m.eroare || !m.id) continue;
      if (!relevant(m)) continue;
      m.sport = s;
      // pe „auto": un meci în desfășurare bate unul programat sau încheiat
      if (!alesul || (m.stare === 2 && alesul.stare !== 2)) alesul = m;
      if (alesul && alesul.stare === 2) break;
    }
    return alesul;
  }

  function relevant(m) {
    var acum = Date.now() / 1000;
    if (m.stare === 2) return true;                       // în desfășurare
    if (m.stare === 1) {
      // vizibil din dimineața zilei DE DINAINTE (miezul nopții precedent)
      var ajun = new Date(m.start * 1000);
      ajun.setHours(0, 0, 0, 0);
      return acum * 1000 >= ajun.getTime() - 86400e3;
    }
    if (m.stare === 3) {
      // încheiat: rămâne până la miezul nopții din ziua meciului
      var miez = new Date(m.start * 1000);
      miez.setHours(24, 0, 0, 0);
      return acum * 1000 < miez.getTime();
    }
    return false;
  }

  /* minutul meciului, calculat din ora de start — curge în timp real */
  function minutul(m) {
    var r = REGULI[m.sport] || REGULI.fotbal;
    var trecute = (Date.now() / 1000 - m.start) / 60;
    if (trecute < 0) return null;
    if (trecute <= r.repriza + 8) {
      // prima repriză (cu prelungirile ei)
      var min1 = Math.min(Math.ceil(trecute), r.repriza);
      return trecute > r.repriza ? r.repriza + "+" : min1 + "'";
    }
    var startR2 = r.repriza + r.pauza;
    if (trecute < startR2) return "Pauză";
    var min2 = Math.min(Math.ceil(trecute - r.pauza), r.repriza * 2);
    return trecute - r.pauza > r.repriza * 2 ? (r.repriza * 2) + "+" : min2 + "'";
  }

  /* codurile de fază Flashscore pe care le cunoaștem sigur */
  function faza(m) {
    if (m.stare === 3) return "final";
    if (m.stare !== 2) {
      var startZi = new Date(m.start * 1000); startZi.setHours(0, 0, 0, 0);
      var aziZi = new Date(); aziZi.setHours(0, 0, 0, 0);
      return startZi.getTime() > aziZi.getTime() ? "maine" : "azi";
    }
    if (m.faza === 38) return "pauza";
    var min = minutul(m);
    return min === "Pauză" ? "pauza" : "joc";
  }

  function eticheta(m) {
    var f = faza(m);
    if (f === "final") return "Final";
    if (f === "pauza") return "Pauză";
    if (f === "maine" || f === "azi") return countdown(m);
    return minutul(m) || "LIVE";
  }

  /* numărătoarea inversă până la start: „1z 07:42:15", curge live */
  function countdown(m) {
    var ramas = Math.max(0, m.start - Date.now() / 1000);
    var z = Math.floor(ramas / 86400);
    var h = Math.floor((ramas % 86400) / 3600);
    var min = Math.floor((ramas % 3600) / 60);
    var s = Math.floor(ramas % 60);
    var hms = ("0" + h).slice(-2) + ":" + ("0" + min).slice(-2) + ":" + ("0" + s).slice(-2);
    return (z > 0 ? z + "z " : "") + hms;
  }

  /* „unde": acasă cu numele arenei (regula lui Teo), în deplasare cu gazdele */
  function unde(m) {
    var acasa = /csm\s*slatina/i.test(m.gazde);
    if (acasa) return m.sport === "fotbal" ? "Acasă · Stadionul 1 Mai" : "Acasă, la Slatina";
    return "În deplasare la " + m.gazde;
  }
  function oraStart(m) {
    var d = new Date(m.start * 1000);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function scorPauza(m) {
    if (m.pauzaGazde == null || m.pauzaGazde === "") return "";
    return "(" + m.pauzaGazde + "–" + m.pauzaOaspeti + " la pauză)";
  }

  function deseneaza() {
    if (!stare) { if (banda) { banda.remove(); banda = null; } return; }
    var m = stare;
    var f = faza(m);
    var areScor = m.scorGazde != null && m.scorGazde !== "";

    if (!banda) {
      banda = document.createElement("aside");
      banda.className = "banda-live";
      banda.setAttribute("aria-label", "Scor live CSM Slatina");
      var antet = document.querySelector(".site-header");
      document.body.insertBefore(banda, antet ? antet.nextSibling : document.body.firstChild);
      document.body.classList.add("cu-banda-live");
    }
    banda.dataset.faza = f;

    if (f === "maine" || f === "azi") {
      banda.innerHTML =
        '<div class="bl-inauntru">' +
          '<span class="bl-insigna">' + (f === "azi" ? "AZI" : "MÂINE") + "</span>" +
          (f === "azi" ? '<span class="bl-hai">Hai la meci!</span>' : "") +
          '<span class="bl-meci">' +
            '<b class="bl-echipa">' + m.gazde + "</b>" +
            '<b class="bl-scor mic">vs</b>' +
            '<b class="bl-echipa">' + m.oaspeti + "</b>" +
          "</span>" +
          '<span class="bl-unde">' + unde(m) + " · " + oraStart(m) + "</span>" +
          '<span class="bl-minut">' + countdown(m) + ' <small>până la start</small></span>' +
        "</div>";
      document.documentElement.style.setProperty("--banda-live-h", banda.offsetHeight + "px");
      return;
    }

    banda.innerHTML =
      '<div class="bl-inauntru">' +
        '<span class="bl-insigna' + (f === "joc" || f === "pauza" ? " puls" : "") + '">' +
          (f === "final" ? "FINAL" : (f === "inainte" ? "AZI" : "LIVE")) + "</span>" +
        '<span class="bl-sport">' + (m.sport === "fotbal" ? "Fotbal" : "Handbal") + "</span>" +
        '<span class="bl-meci">' +
          '<b class="bl-echipa">' + m.gazde + "</b>" +
          (areScor
            ? '<b class="bl-scor">' + m.scorGazde + "–" + m.scorOaspeti + "</b>"
            : '<b class="bl-scor mic">vs</b>') +
          '<b class="bl-echipa">' + m.oaspeti + "</b>" +
        "</span>" +
        (f === "final"
          ? (scorPauza(m) ? '<span class="bl-minut doar-pauza">' + scorPauza(m) + "</span>" : "")
          : '<span class="bl-minut">' + eticheta(m) +
              (f !== "inainte" ? ' <small>' + scorPauza(m) + "</small>" : "") +
            "</span>") +
      "</div>";

    // înălțimea reală a benzii împinge conținutul paginii (mobilul o
    // frânge pe două rânduri, deci nu putem ghici o valoare fixă)
    document.documentElement.style.setProperty("--banda-live-h", banda.offsetHeight + "px");
  }

  /* pentru verificat vizual fără meci real: ?livetest=maine|azi|joc|pauza|final */
  var TEST = (location.search.match(/[?&]livetest=([a-z]+)/) || [])[1];
  function probaDeTest() {
    var acum = Math.floor(Date.now() / 1000);
    var m = { fotbal: null, handbal: null };
    var f = { id: "test", gazde: "CSM Slatina", oaspeti: "Steaua București",
              scorGazde: null, scorOaspeti: null, pauzaGazde: null, pauzaOaspeti: null };
    if (TEST === "maine") { f.stare = 1; f.start = acum + 86400 + 7200; }
    if (TEST === "azi")   { f.stare = 1; f.start = acum + 3600; }   // peste o oră, sigur azi
    if (TEST === "joc")   { f.stare = 2; f.faza = 12; f.start = acum - 23 * 60; f.scorGazde = "1"; f.scorOaspeti = "0"; }
    if (TEST === "pauza") { f.stare = 2; f.faza = 38; f.start = acum - 50 * 60; f.scorGazde = "1"; f.scorOaspeti = "0"; f.pauzaGazde = "1"; f.pauzaOaspeti = "0"; }
    if (TEST === "final") { f.stare = 3; f.faza = 3;  f.start = acum - 2 * 3600; f.scorGazde = "2"; f.scorOaspeti = "1"; f.pauzaGazde = "1"; f.pauzaOaspeti = "0"; }
    m.fotbal = f;
    return m;
  }

  function actualizeaza() {
    if (TEST) { stare = alege(probaDeTest()); deseneaza(); return; }
    fetch(ADRESA, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (date) {
        stare = alege(date);
        deseneaza();
      })
      .catch(function () { /* păstrăm ce aveam; reîncercăm la următorul tact */ });
  }

  /* Antetul se strânge de la 84 la 68px când derulezi (clasa .scrolled),
     deci banda nu poate sta pironită la o valoare fixă — altfel rămâne un
     gol între ele. O legăm de înălțimea REALĂ a antetului, urmărită cadru
     cu cadru cât ține tranziția. */
  function urmaresteAntetul() {
    var antet = document.querySelector(".site-header");
    if (!antet) return;
    var scrie = function () {
      document.documentElement.style.setProperty("--banda-sus", antet.offsetHeight + "px");
    };
    scrie();
    if (window.ResizeObserver) new ResizeObserver(scrie).observe(antet);
    else window.addEventListener("scroll", scrie, { passive: true });
  }

  function porneste() {
    urmaresteAntetul();
    window.addEventListener("resize", function () {
      if (banda) document.documentElement.style.setProperty("--banda-live-h", banda.offsetHeight + "px");
    });
    actualizeaza();
    setInterval(function () {
      if (!document.hidden) actualizeaza();
    }, INTERVAL);
    // minutul curge secundă de secundă, fără să așteptăm releul
    cronometru = setInterval(function () {
      if (stare && banda && stare.stare !== 3) {
        var el = banda.querySelector(".bl-minut");
        if (el) el.firstChild.nodeValue = eticheta(stare) + (stare.stare === 1 ? " " : "");
      }
    }, 1000);
  }

  porneste();
})();
