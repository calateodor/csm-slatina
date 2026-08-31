/* =========================================================
   Tenis de masă — perechea „card + fișă" a sportivei secției.
   ---------------------------------------------------------
   Stânga: cardul vizual, în formula cardului lui Arun de la box
   (poză, nume pe verticală, cifră-fantomă, fișă de sticlă
   desfășurabilă, înclinare 3D după mouse) — dar cu limbajul
   tenisului de masă: medaliile, bara aurului și turneele WTT.
   Dreapta: fișa care continuă cardul — palmaresul pe ani,
   antrenoarele și distincțiile.

   Cifrele vin din data/tenis-de-masa.json. Nu există bază de date
   publică pentru juniori (echivalentul BoxRec), deci fișierul se
   ține de mână după anunțurile WTT, ETTU și FRTM.
   ========================================================= */
(function () {
  "use strict";

  var gazda = document.getElementById("tm-sportiv");
  if (!gazda || typeof fetch === "undefined") return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  fetch("../data/tenis-de-masa.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var s = d.sportiv;
      if (!s) return;
      var m = s.medalii || {};
      var total = (m.aur || 0) + (m.argint || 0) + (m.bronz || 0);
      var procent = total ? (m.aur / total) * 100 : 0;
      var nume = String(s.nume || "").split(" ");
      var prenume = nume.shift();
      var familie = nume.join(" ");

      /* ---------- stânga: cardul vizual ---------- */
      var masuri = [
        { mare: total, mic: "medalii" },
        { mare: s.turneeWtt, mic: "turnee WTT" },
        { mare: s.titluriNationale2025, mic: "titluri '25" },
        { mare: s.varsta, mic: "ani" }
      ].filter(function (x) { return x.mare != null; });

      var vizual =
        '<article class="tv-card">' +
          (s.poza ? '<img class="tv-poza" src="../' + esc(s.poza) + '" alt="' + esc(s.numeIntreg || s.nume) + '" loading="lazy">' : "") +
          '<span class="tv-fantoma" aria-hidden="true">' + esc(m.aur) + "</span>" +
          '<span class="tv-vert" aria-hidden="true"><i>' + esc(prenume) + "</i><b>" + esc(familie) + "</b></span>" +
          '<span class="tv-loc">' + esc(s.insigna) + "</span>" +
          '<div class="tv-jos"><div class="tv-sticla">' +
            '<div class="tv-cap">' +
              "<div><p>" + esc(prenume) + '</p><h3>' + esc(familie) + "</h3></div>" +
              '<span class="tv-categorie">' + esc(s.categorie) + "</span>" +
            "</div>" +
            '<div class="tv-medalii" title="aur · argint · bronz în ' + esc(s.sezon) + '">' +
              '<span class="aur"><b>' + esc(m.aur) + "</b><i>aur</i></span>" +
              '<span class="arg"><b>' + esc(m.argint) + "</b><i>argint</i></span>" +
              '<span class="brz"><b>' + esc(m.bronz) + "</b><i>bronz</i></span>" +
            "</div>" +
            /* butonul + partea desfășurabilă: închis se văd doar numele
               și bilanțul de medalii */
            '<button type="button" class="tv-mai" aria-expanded="false">Detalii <b>+</b></button>' +
            '<div class="tv-rest"><div>' +
              '<div class="tv-bara-cap"><span>Medalii de aur <i>' + esc(m.aur) + " din " + esc(total) + "</i></span><b>" +
                procent.toFixed(0) + "%</b></div>" +
              '<div class="tv-bara"><span style="width:' + procent.toFixed(1) + '%"></span></div>' +
              '<div class="tv-masuri">' +
                masuri.map(function (x) {
                  return '<span class="tv-masura"><b>' + esc(x.mare) + "</b><i>" + esc(x.mic) + "</i></span>";
                }).join("") +
              "</div>" +
            "</div></div>" +
          "</div></div>" +
          '<i class="tv-lucire" aria-hidden="true"></i>' +
        "</article>";

      /* ---------- dreapta: fișa care continuă cardul ---------- */
      var palmares = (s.palmares || []).map(function (p) {
        return "<li><b>" + esc(p.an) + "</b><span>" + esc(p.text) +
          (p.categorie ? ' <i>' + esc(p.categorie) + "</i>" : "") + "</span></li>";
      }).join("");

      var fisa =
        '<div class="ts-card">' +
          '<p class="ts-eticheta">Palmares</p>' +
          '<ol class="ts-palmares">' + palmares + "</ol>" +
          '<div class="ts-subsol">' +
            "<p>Antrenori: <b>" + (s.antrenori || []).map(esc).join(", ") + "</b></p>" +
            (s.distinctii ? '<p class="ts-distinctii">' + esc(s.distinctii) + "</p>" : "") +
            (s.surse ? '<p class="ts-sursa">' + esc(s.surse) + " · bilanțul de mai sus e suma medaliilor din palmares.</p>" : "") +
          "</div>" +
        "</div>";

      gazda.innerHTML = '<div class="ts-duo">' + vizual + fisa + "</div>";

      /* comutatorul „Detalii" */
      var card = gazda.querySelector(".tv-card");
      var buton = gazda.querySelector(".tv-mai");
      if (card && buton) {
        buton.addEventListener("click", function () {
          var extins = card.classList.toggle("extins");
          buton.setAttribute("aria-expanded", extins ? "true" : "false");
          buton.innerHTML = extins ? "Mai puțin <b>–</b>" : "Detalii <b>+</b>";
        });
      }

      /* Înclinarea 3D + parallax + dunga de lucire. Doar unde există hover
         adevărat: pe touch tilt-ul ar rămâne înțepenit după un tap. */
      var cuCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      var miscareRedusa = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* Pe ecranele fără cursor mișcarea vine DOAR din derulare, iar atingerea
         nu face nimic: cardul intră înclinat de jos și se așază drept exact
         când ajunge în mijlocul ecranului, cu dunga de lucire deja traversată.
         Vezi js/card-miscare.js. */
      if (card && !cuCursor && !miscareRedusa && window.CardMiscare) {
        window.CardMiscare.pornesteDerulare({
          card: card,
          poza: card.querySelector(".tv-poza"),
          lucire: card.querySelector(".tv-lucire"),
          nume: { my: "--tmy", mx: "--tmx", pax: "--tpax", pay: "--tpay", lux: "--tlux", luy: "--tluy" },
          coef: { my: 20, mx: -12, pax: 30, pay: 14 }
        });
      }

      if (card && cuCursor && !miscareRedusa) {
        var poza = card.querySelector(".tv-poza");
        var luc = card.querySelector(".tv-lucire");

        card.addEventListener("mousemove", function (ev) {
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width - 0.5;   // -0,5 .. 0,5
          var py = (ev.clientY - r.top) / r.height - 0.5;
          card.classList.add("urmareste");
          /* Același sens ca la cardul lui Arun: mouse-ul în dreapta duce
             muchia dreaptă în spate, cardul se răsucește spre dreapta.
             Coeficienții sunt dublul unghiului dorit, pentru că px/py sunt
             fracțiuni -0,5..0,5: 20 și 12 dau ±10° și ±6°. */
          card.style.setProperty("--tmy", (px * 20).toFixed(2) + "deg");
          card.style.setProperty("--tmx", (py * -12).toFixed(2) + "deg");
          if (poza) {
            /* Decupajul plutește DEASUPRA cardului, exact ca la Arun: un strat
               la adâncime pozitivă se rotește odată cu cardul în jurul centrului
               lui, deci se proiectează cu offsetul d·sin(unghi) — adică pleacă
               în aceeași parte cu cursorul. Semnele merg mereu împreună cu cele
               ale rotirii de mai sus; dacă se schimbă unul, se schimbă și
               celălalt, altfel adâncimea se citește invers. */
            poza.style.setProperty("--tpax", (px * 30).toFixed(1) + "px");
            poza.style.setProperty("--tpay", (py * 14).toFixed(1) + "px");
          }
          if (luc) {
            luc.style.setProperty("--tlux", px.toFixed(3));
            luc.style.setProperty("--tluy", py.toFixed(3));
          }
        });

        card.addEventListener("mouseleave", function () {
          card.classList.remove("urmareste");
          card.style.removeProperty("--tmy");
          card.style.removeProperty("--tmx");
          if (poza) {
            poza.style.removeProperty("--tpax");
            poza.style.removeProperty("--tpay");
          }
          if (luc) {
            luc.style.removeProperty("--tlux");
            luc.style.removeProperty("--tluy");
          }
        });
      }
    })
    .catch(function () { /* fără fișier, secțiunea rămâne goală */ });
})();
