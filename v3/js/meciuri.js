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

  fetch("data/meciuri.json")
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

      // varianta scurtă, pentru cardul strâns de pe telefon: „dum, 30 aug · 18:00”
      var mic = document.getElementById("meci-mic");
      if (mic) {
        mic.textContent = data.toLocaleDateString("ro-RO", {
          weekday: "short", day: "numeric", month: "short"
        }).replace(/\.$/, "") + " · " + ora;
      }

      text.innerHTML = "";
      text.appendChild(document.createTextNode(curata(urmator.gazde) + " – " + curata(urmator.oaspeti)));
      text.appendChild(document.createElement("br"));
      text.appendChild(document.createTextNode(zi + ", " + ora));
      if (urmator.sursa) card.href = urmator.sursa;
    })
    .catch(function () { /* păstrăm fallback-ul static */ });
})();
