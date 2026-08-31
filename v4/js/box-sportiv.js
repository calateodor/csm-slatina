/* =========================================================
   Box — perechea „card + fișă" a sportivului secției.
   ---------------------------------------------------------
   Stânga: cardul vizual, în formula cardurilor de la fotbal
   (poză decupată, nume pe verticală, cifră-fantomă, fișă de
   sticlă jos) — dar cu limbajul boxului: recordul, bara de
   KO-uri și clasarea.
   Dreapta: fișa care continuă cardul — palmaresul pe ani,
   antrenorii și locul clubului în ierarhia FR Box.

   Cifrele vin din data/box.json (BoxRec se ține de mână,
   clasamentul cluburilor îl aduce scripts/actualizeaza-box.py).
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
      var nume = String(s.nume || "").split(" ");
      var prenume = nume.shift();
      var familie = nume.join(" ");
      var procent = parseFloat(String(s.procentKo || "0").replace(",", ".")) || 0;
      var varsta = s.nascut ? (new Date().getFullYear() - s.nascut) : null;

      /* ---------- stânga: cardul vizual ---------- */
      var masuri = [
        { mare: s.meciuri, mic: "meciuri" },
        { mare: s.runde, mic: "runde" },
        { mare: r.ko, mic: "prin KO" }
      ];
      if (varsta) masuri.push({ mare: varsta, mic: "ani" });

      var vizual =
        '<article class="bv-card">' +
          (s.poza ? '<img class="bv-poza" src="../' + esc(s.poza) + '" alt="' + esc(s.nume) + '" loading="lazy">' : "") +
          '<span class="bv-fantoma" aria-hidden="true">' + esc(r.victorii) + "</span>" +
          '<span class="bv-vert" aria-hidden="true"><i>' + esc(prenume) + "</i><b>" + esc(familie) + "</b></span>" +
          '<span class="bv-loc">#' + esc(s.loculRomania) + " în România</span>" +
          '<div class="bv-jos"><div class="bv-sticla">' +
            '<div class="bv-cap">' +
              "<div><p>" + esc(prenume) + '</p><h3>' + esc(familie) + "</h3></div>" +
              '<span class="bv-categorie">' + esc(s.categorie) + "</span>" +
            "</div>" +
            '<div class="bv-record" title="victorii · înfrângeri · egaluri">' +
              '<span class="v"><b>' + esc(r.victorii) + "</b><i>V</i></span>" +
              '<span class="i"><b>' + esc(r.infrangeri) + "</b><i>Î</i></span>" +
              '<span class="e"><b>' + esc(r.egaluri) + "</b><i>E</i></span>" +
            "</div>" +
            /* butonul + partea desfășurabilă, exact ca la cardurile de fotbal:
               închis se văd doar numele și recordul */
            '<button type="button" class="bv-mai" aria-expanded="false">Detalii <b>+</b></button>' +
            '<div class="bv-rest"><div>' +
              '<div class="bv-ko">' +
                '<div class="bv-ko-cap"><span>Victorii prin KO <i>' + esc(r.ko) + ' din ' + esc(r.victorii) + '</i></span><b>' + esc(s.procentKo) + "</b></div>" +
                '<div class="bv-bara"><span style="width:' + procent.toFixed(1) + '%"></span></div>' +
              "</div>" +
              '<div class="bv-masuri">' +
                masuri.map(function (m) {
                  return '<span class="bv-masura"><b>' + esc(m.mare) + "</b><i>" + esc(m.mic) + "</i></span>";
                }).join("") +
              "</div>" +
            "</div></div>" +
          "</div></div>" +
          /* dunga de lucire care traversează cardul după mouse (doar desktop) */
          '<i class="bv-lucire" aria-hidden="true"></i>' +
        "</article>";

      /* ---------- dreapta: fișa care continuă cardul ---------- */
      var palmares = (s.palmares || []).map(function (p) {
        return '<li><b>' + esc(p.an) + "</b><span>" + esc(p.text) +
          (p.categorie ? ' <i>' + esc(p.categorie) + "</i>" : "") + "</span></li>";
      }).join("");

      var fisa =
        '<div class="bs-card">' +
          '<p class="bs-eticheta">Palmares</p>' +
          '<ol class="bs-palmares">' + palmares + "</ol>" +
          '<div class="bs-subsol">' +
            "<p>Antrenori: <b>" + (s.antrenori || []).map(esc).join(" și ") + "</b></p>" +
            (s.tinta ? "<p>Țintă: <b>" + esc(s.tinta) + "</b> · debut la <b>" + esc(s.debut) + "</b></p>" : "") +
            (cl.loc
              ? '<p class="bs-club">CSM Slatina — locul <b>' + esc(cl.loc) + "</b> în clasamentul cluburilor " +
                esc(cl.an) + " (" + esc(cl.puncte) + " puncte, " + esc(cl.sportivi) + " sportivi) · " +
                '<a href="' + esc(cl.sursa) + '" target="_blank" rel="noopener">FR Box</a></p>'
              : "") +
            (s.boxrec ? '<p class="bs-sursa">Palmares complet pe <a href="' + esc(s.boxrec) +
              '" target="_blank" rel="noopener">BoxRec</a> · #' + esc(s.loculMondial) +
              " mondial din " + esc(s.dinTotalMondial) + "</p>" : "") +
          "</div>" +
        "</div>";

      gazda.innerHTML = '<div class="bs-duo">' + vizual + fisa + "</div>";

      /* comutatorul „Detalii", identic cu cel de pe cardurile de fotbal */
      var card = gazda.querySelector(".bv-card");
      var buton = gazda.querySelector(".bv-mai");
      if (card && buton) {
        buton.addEventListener("click", function () {
          var extins = card.classList.toggle("extins");
          buton.setAttribute("aria-expanded", extins ? "true" : "false");
          buton.innerHTML = extins ? "Mai puțin <b>–</b>" : "Detalii <b>+</b>";
        });
      }

      /* Înclinarea 3D + plutirea pozei + dunga de lucire, exact ca la cardurile
         de fotbal (lot.js). Numai unde există hover adevărat: pe touch tilt-ul
         ar rămâne înțepenit după un tap, iar lucirea la fel.
         Cine cere mișcare redusă rămâne fără ele — CSS-ul le-ar anula oricum,
         dar nici nu are rost să scriem variabile la fiecare cadru. */
      var cuCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      var miscareRedusa = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* Pe ecranele fără cursor mișcarea vine din derulare și din deget —
         aceiași coeficienți, ca senzația să fie identică cu cea de pe desktop.
         Vezi js/card-miscare.js. */
      if (card && !cuCursor && !miscareRedusa && window.CardMiscare) {
        window.CardMiscare.pornesteTouch({
          card: card,
          poza: card.querySelector(".bv-poza"),
          lucire: card.querySelector(".bv-lucire"),
          nume: { my: "--my", mx: "--mx", pax: "--pax", pay: "--pay", lux: "--lux", luy: "--luy" },
          coef: { my: 20, mx: -12, pax: 34, pay: 14 }
        });
      }

      if (card && cuCursor && !miscareRedusa) {
        var poza = card.querySelector(".bv-poza");
        var luc = card.querySelector(".bv-lucire");

        card.addEventListener("mousemove", function (ev) {
          var r = card.getBoundingClientRect();
          // fracțiuni -0.5..0.5 față de centrul cardului
          var px = (ev.clientX - r.left) / r.width - 0.5;
          var py = (ev.clientY - r.top) / r.height - 0.5;
          card.classList.add("urmareste");
          /* Sensul rotirii, ales de Teo: mouse-ul în dreapta duce muchia
             dreaptă ÎN SPATE, iar cea stângă vine spre privitor — cardul se
             răsucește spre dreapta ca o ușă, nu se apleacă spre cursor.
             (rotateY pozitiv trimite muchia dreaptă în adâncime.) Aceleași
             semne ca la cardurile de fotbal.
             Coeficienții sunt însă mult mai mari decât acolo, pentru că px/py
             sunt fracțiuni -0,5..0,5, nu -1..1: factorul se înjumătățește.
             20 și 12 dau ±10° pe orizontală și ±6° pe verticală — la valorile
             de la fotbal ieșeau ±3°, invizibile pe un card atât de mare. */
          card.style.setProperty("--my", (px * 20).toFixed(2) + "deg");
          card.style.setProperty("--mx", (py * -12).toFixed(2) + "deg");
          if (poza) {
            /* Decupajul plutește DEASUPRA cardului: un strat la adâncime
               pozitivă se rotește odată cu cardul în jurul centrului lui, deci
               se proiectează cu offsetul d·sin(unghi) — adică pleacă în aceeași
               parte cu cursorul, spre muchia care se duce în spate.
               Semnele merg mereu împreună cu cele ale rotirii de mai sus: dacă
               se schimbă unul, se schimbă și celălalt, altfel poza plutește
               spre partea greșită și adâncimea se citește invers.
               Pe verticală, deplasarea totală rămâne 1..15px față de baza de
               8px, deci mereu pozitivă: marginea de jos, unde fotografia e
               tăiată drept, nu urcă niciodată în interiorul cardului. */
            poza.style.setProperty("--pax", (px * 34).toFixed(1) + "px");
            poza.style.setProperty("--pay", (py * 14).toFixed(1) + "px");
          }
          if (luc) {
            luc.style.setProperty("--lux", px.toFixed(3));
            luc.style.setProperty("--luy", py.toFixed(3));
          }
        });

        card.addEventListener("mouseleave", function () {
          card.classList.remove("urmareste");
          card.style.removeProperty("--my");
          card.style.removeProperty("--mx");
          if (poza) {
            poza.style.removeProperty("--pax");
            poza.style.removeProperty("--pay");
          }
          if (luc) {
            luc.style.removeProperty("--lux");
            luc.style.removeProperty("--luy");
          }
        });
      }
    })
    .catch(function () { /* fără fișier, secțiunea rămâne goală */ });
})();
