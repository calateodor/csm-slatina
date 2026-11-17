/* =========================================================
   CSM Slatina — cardul „Calendar" din hero
   Arată primul meci viitor de fotbal sau handbal. Sursa e
   releul Cloudflare (/calendar), care citește Flashscore în
   timp real — aceeași sursă ca pagina de știri și banda live.
   Dacă releul nu răspunde sau n-are niciun meci viitor, cade
   pe data/meciuri.json; dacă nici acolo nu e nimic, rămâne
   textul static din HTML.
   ========================================================= */
(function () {
  "use strict";

  var kicker = document.getElementById("meci-kicker");
  var text = document.getElementById("meci-text");
  var card = document.getElementById("ha-meci");
  if (!kicker || !text || !card || typeof fetch === "undefined") return;

  var RELEU = "https://csm-live.worker-live.workers.dev/calendar";

  function curata(nume) {
    // Flashscore marchează echipele feminine cu sufixul „ F"
    return String(nume || "").replace(/\s+F$/, "");
  }
  // releul scrie „Fotbal", fișierele statice uneori „fotbal"
  function numeSport(s) {
    s = String(s || "");
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function primulViitor(d) {
    var acum = Date.now() / 1000;
    var lista = (d && d.meciuri || []).filter(function (m) { return m.timestamp > acum; });
    lista.sort(function (a, b) { return a.timestamp - b.timestamp; });
    if (!lista.length) throw new Error("niciun meci viitor");
    return lista[0];
  }
  function ia(adresa) {
    return fetch(adresa, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(primulViitor);
  }

  function arata(urmator) {
    var data = new Date(urmator.timestamp * 1000);
    var zi = data.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
    var ora = data.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    var sport = numeSport(urmator.sport);

    kicker.textContent = sport + (urmator.competitie ? " · " + urmator.competitie : "");

    // varianta pentru cardul strâns de pe telefon: se înțelege singură —
    // „Handbal în deplasare la Corona Brașov, marți 17 nov, 18:15”
    var mic = document.getElementById("meci-mic");
    if (mic) {
      var noi = /csm\s*slatina/i;
      var acasa = noi.test(urmator.gazde);
      var adversar = curata(acasa ? urmator.oaspeti : urmator.gazde);
      var ziScurt = data.toLocaleDateString("ro-RO", {
        weekday: "long", day: "numeric", month: "short"
      }).replace(/\./g, "");
      mic.textContent = sport + (acasa ? " acasă cu " : " în deplasare la ") +
        adversar + ", " + ziScurt + ", " + ora;
    }

    text.innerHTML = "";
    text.appendChild(document.createTextNode(curata(urmator.gazde) + " – " + curata(urmator.oaspeti)));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(zi + ", " + ora));
    if (urmator.sursa) card.href = urmator.sursa;
  }

  ia(RELEU)
    .catch(function () { return ia("data/meciuri.json"); })
    .then(arata)
    .catch(function () { /* păstrăm textul static */ });
})();
