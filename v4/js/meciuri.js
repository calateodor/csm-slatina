/* =========================================================
   CSM Slatina — cardul „Calendar" din hero
   Citește data/meciuri.json (generat din Flashscore de
   scripts/actualizeaza-meciuri.py) și afișează primul meci
   viitor de fotbal sau handbal. Dacă fișierul lipsește,
   rămâne textul static din HTML.
   ========================================================= */
(function () {
  "use strict";

  var kicker = document.getElementById("meci-kicker");
  var text = document.getElementById("meci-text");
  var card = document.getElementById("ha-meci");
  if (!kicker || !text || !card || typeof fetch === "undefined") return;

  function curata(nume) {
    // Flashscore marchează echipele feminine cu sufixul „ F"
    return nume.replace(/\s+F$/, "");
  }

  fetch("data/meciuri.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var acum = Date.now() / 1000;
      var urmator = (d.meciuri || []).filter(function (m) {
        return m.timestamp > acum;
      })[0];
      if (!urmator) return;

      var data = new Date(urmator.timestamp * 1000);
      var zi = data.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
      var ora = data.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

      kicker.textContent = urmator.sport + " · " + urmator.competitie;

      // varianta pentru cardul strâns de pe telefon: se înțelege singură —
      // „Handbal cu SCM Craiova, duminică 30 aug, 18:00”
      var mic = document.getElementById("meci-mic");
      if (mic) {
        var noi = /csm\s*slatina/i;
        var adversar = curata(noi.test(urmator.gazde) ? urmator.oaspeti : urmator.gazde);
        var acasa = noi.test(urmator.gazde);
        var ziScurt = data.toLocaleDateString("ro-RO", {
          weekday: "long", day: "numeric", month: "short"
        }).replace(/\./g, "");
        mic.textContent = urmator.sport + (acasa ? " acasă cu " : " în deplasare la ") +
          adversar + ", " + ziScurt + ", " + ora;
      }

      text.innerHTML = "";
      text.appendChild(document.createTextNode(curata(urmator.gazde) + " – " + curata(urmator.oaspeti)));
      text.appendChild(document.createElement("br"));
      text.appendChild(document.createTextNode(zi + ", " + ora));
      if (urmator.sursa) card.href = urmator.sursa;
    })
    .catch(function () { /* păstrăm fallback-ul static */ });
})();
