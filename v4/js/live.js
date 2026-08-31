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
    if (m.stare === 1) return m.start - acum < 3600 * 3;  // începe în max 3 ore
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
    if (m.stare !== 2) return "inainte";
    if (m.faza === 38) return "pauza";
    var min = minutul(m);
    return min === "Pauză" ? "pauza" : "joc";
  }

  function eticheta(m) {
    var f = faza(m);
    if (f === "final") return "Final";
    if (f === "pauza") return "Pauză";
    if (f === "inainte") {
      var d = new Date(m.start * 1000);
      return "Începe la " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    }
    return minutul(m) || "LIVE";
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

  function actualizeaza() {
    fetch(ADRESA, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (date) {
        stare = alege(date);
        deseneaza();
      })
      .catch(function () { /* păstrăm ce aveam; reîncercăm la următorul tact */ });
  }

  function porneste() {
    window.addEventListener("resize", function () {
      if (banda) document.documentElement.style.setProperty("--banda-live-h", banda.offsetHeight + "px");
    });
    actualizeaza();
    setInterval(function () {
      if (!document.hidden) actualizeaza();
    }, INTERVAL);
    // minutul curge secundă de secundă, fără să așteptăm releul
    cronometru = setInterval(function () {
      if (stare && stare.stare === 2 && banda) {
        var el = banda.querySelector(".bl-minut");
        if (el) el.firstChild.nodeValue = eticheta(stare);
      }
    }, 1000);
  }

  porneste();
})();
