/* =========================================================
   Box — cardul sportivului, construit din data/box.json
   ---------------------------------------------------------
   Cifrele de palmares vin din BoxRec și se țin de mână în
   box.json (BoxRec nu poate fi citit automat), iar poziția
   clubului în clasamentul FR Box e adusă de
   scripts/actualizeaza-box.py.
   ========================================================= */
(function () {
  "use strict";

  var gazda = document.getElementById("box-sportiv");
  if (!gazda || typeof fetch === "undefined") return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  fetch("../data/box.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var s = d.sportiv;
      if (!s) return;
      var r = s.record || {};
      var cl = d.clasamentCluburi || {};

      var cifre = [
        { mare: r.victorii + "–" + r.infrangeri + "–" + r.egaluri, mic: "victorii · înfrângeri · egaluri" },
        { mare: s.meciuri, mic: "meciuri disputate" },
        { mare: r.ko, mic: "victorii prin KO" },
        { mare: "#" + s.loculRomania, mic: "în România, din " + s.dinTotalRomania }
      ];

      var palmares = (s.palmares || []).map(function (p) {
        return '<li><b>' + esc(p.an) + "</b><span>" + esc(p.text) +
          (p.categorie ? ' <i>' + esc(p.categorie) + "</i>" : "") + "</span></li>";
      }).join("");

      gazda.innerHTML =
        /* fără clasa „reveal": elementele create după încărcare nu mai sunt
           prinse de ScrollTrigger și ar rămâne invizibile, la opacitate 0 */
        '<article class="bs-card">' +
          '<header class="bs-cap">' +
            '<span class="bs-eticheta">Sportivul secției</span>' +
            "<h3>" + esc(s.nume) + "</h3>" +
            '<p class="bs-sub">' + esc(s.categorie) + " · născut " + esc(s.nascut) +
              " · debut " + esc(s.debut) + "</p>" +
          "</header>" +
          '<div class="bs-cifre">' +
            cifre.map(function (c) {
              return '<div class="bs-cifra"><strong>' + esc(c.mare) + "</strong><span>" + esc(c.mic) + "</span></div>";
            }).join("") +
          "</div>" +
          '<ol class="bs-palmares">' + palmares + "</ol>" +
          '<footer class="bs-subsol">' +
            "<p>Antrenori: <b>" + (s.antrenori || []).map(esc).join(" și ") + "</b>" +
              (s.tinta ? ' · Țintă: <b>' + esc(s.tinta) + "</b>" : "") + "</p>" +
            (cl.loc
              ? '<p class="bs-club">CSM Slatina — locul <b>' + esc(cl.loc) + "</b> în clasamentul cluburilor " +
                esc(cl.an) + " (" + esc(cl.puncte) + " puncte, " + esc(cl.sportivi) + " sportivi) · " +
                '<a href="' + esc(cl.sursa) + '" target="_blank" rel="noopener">FR Box</a></p>'
              : "") +
            (s.boxrec ? '<p class="bs-sursa">Palmares: <a href="' + esc(s.boxrec) +
              '" target="_blank" rel="noopener">BoxRec</a></p>' : "") +
          "</footer>" +
        "</article>";
    })
    .catch(function () { /* fără fișier, secțiunea rămâne goală */ });
})();
