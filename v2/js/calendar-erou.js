/* Calendarul din hero: grila lunii cu meciurile viitoare, în stilul
   wallpaper-ului de club — numerele albe, iar în zilele de meci o minge
   în locul numărului, cu avion la deplasare și stadion acasă. Datele vin
   din același echipe.json ca restul paginii. */
(function () {
  "use strict";

  var radacina = document.getElementById("calendar-meciuri");
  if (!radacina) return;
  var sport = radacina.getAttribute("data-sport") || "fotbal";

  var LUNI = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
              "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
  var LUNI_SCURT = ["ian", "feb", "mar", "apr", "mai", "iun",
                    "iul", "aug", "sep", "oct", "nov", "dec"];
  var ZILE_SCURT = ["dum", "lun", "mar", "mie", "joi", "vin", "sâm"];
  // capul de tabel, de luni la duminică
  var INITIALE = [["L", "luni"], ["M", "marți"], ["M", "miercuri"], ["J", "joi"],
                  ["V", "vineri"], ["S", "sâmbătă"], ["D", "duminică"]];

  var BALON =
    '<svg class="cal-balon" viewBox="0 0 36 36" aria-hidden="true">' +
    '<circle cx="18" cy="18" r="15.5" fill="#fff"/>' +
    '<path d="M18 11.2l5.6 4.1-2.1 6.6h-7l-2.1-6.6z" fill="#2a5298"/>' +
    '<g stroke="#2a5298" stroke-width="2.2" fill="none" stroke-linecap="round">' +
    '<path d="M18 3.2v8M30.8 13.5l-7.2 1.8M25.9 30l-4.4-7.1M10.1 30l4.4-7.1M5.2 13.5l7.2 1.8"/>' +
    "</g>" +
    '<circle cx="18" cy="18" r="15.5" fill="none" stroke="#2a5298" stroke-width="1.6"/>' +
    "</svg>";

  var AVION =
    '<svg class="cal-semn" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3 20.5l18.5-8.2L3 4.1v6.1l12.5 2.1L3 14.4z" fill="#fff"/>' +
    "</svg>";

  var STADION =
    '<svg class="cal-semn" viewBox="0 0 24 24" aria-hidden="true">' +
    '<g fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round">' +
    '<ellipse cx="12" cy="15.2" rx="8.6" ry="3.6"/>' +
    '<path d="M3.4 15.2v-3.4c0-2 3.9-3.7 8.6-3.7s8.6 1.7 8.6 3.7v3.4"/>' +
    "</g></svg>";

  function cheia(an, luna) { return an * 12 + luna; }

  /* Hero-ul e înalt, așa că îl parcurgem ca la Plaja Olt: imaginea rămâne
     puțin în urmă, iar textul și calendarul urcă și se sting pe măsură ce
     secțiunea iese din ecran. Astfel înălțimea devine o traversare, nu un
     bloc uriaș care se târăște. Doar pe desktop — pe telefon imaginea e în
     flux, iar mișcarea suprapusă ar face derularea greoaie. */
  function paralax() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    if (!window.matchMedia("(min-width: 881px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var erou = document.querySelector(".erou-calendar");
    var poza = document.querySelector(".erou-echipa");
    var text = document.querySelector(".erou-text");
    if (!erou) return;

    // Jucătorii rămân serios în urmă și cresc ușor, ca fundalul de la Plaja
    // Olt. Diagonala se mișcă cu aceiași pixeli ca ei, să pară același plan;
    // pe scală nu e nevoie de sincron, PNG-ul e transparent și nu are racord.
    var taiere = document.querySelector(".erou-taietura");
    if (poza) {
      gsap.to(poza, {
        yPercent: 20, scale: 1.07, transformOrigin: "50% 100%", ease: "none",
        scrollTrigger: { trigger: erou, start: "top top", end: "bottom top", scrub: 0.5 }
      });
      if (taiere) {
        gsap.to(taiere, {
          "--taiere-y": function () {
            return (poza.offsetHeight * 0.2).toFixed(1) + "px";
          },
          ease: "none",
          scrollTrigger: { trigger: erou, start: "top top", end: "bottom top", scrub: 0.5 }
        });
      }
    }
    // calendarul și textul urcă apăsat și se sting pe măsură ce ies pe sus:
    // cursa e legată de elementul însuși, nu de secțiune, altfel s-ar
    // decolora cât sunt încă întregi pe ecran
    gsap.to(radacina, {
      yPercent: -30, opacity: 0, ease: "none",
      scrollTrigger: { trigger: radacina, start: "top top", end: "bottom top", scrub: 0.5 }
    });
    if (text) {
      gsap.to(text, {
        yPercent: -60, opacity: 0, ease: "none",
        scrollTrigger: { trigger: text, start: "top top", end: "bottom top", scrub: 0.5 }
      });
    }
  }

  fetch("../data/echipe.json")
    .then(function (r) { return r.json(); })
    .then(function (date) {
      var prog = (date[sport] && date[sport].program) || [];
      var meciuri = prog.map(function (m) {
        var d = new Date(m.timestamp * 1000);
        return {
          an: d.getFullYear(), luna: d.getMonth(), zi: d.getDate(),
          ziSapt: d.getDay(),
          ora: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2),
          adversar: m.acasa ? m.oaspeti : m.gazde,
          acasa: !!m.acasa
        };
      });
      if (!meciuri.length) { radacina.style.display = "none"; return; }

      var azi = new Date();
      var chAzi = cheia(azi.getFullYear(), azi.getMonth());
      var chMin = chAzi, chMax = chAzi;
      meciuri.forEach(function (m) {
        var c = cheia(m.an, m.luna);
        if (c < chMin) chMin = c;
        if (c > chMax) chMax = c;
      });
      // luna de pornire: cea a primului meci care nu a trecut încă
      var chCurent = chMax;
      for (var i = 0; i < meciuri.length; i++) {
        var m = meciuri[i];
        var c = cheia(m.an, m.luna);
        if (c > chAzi || (c === chAzi && m.zi >= azi.getDate())) { chCurent = c; break; }
      }

      function deseneaza() {
        var an = Math.floor(chCurent / 12), luna = chCurent % 12;
        var inLuna = {};
        meciuri.forEach(function (m) {
          if (m.an === an && m.luna === luna) inLuna[m.zi] = m;
        });

        var h = '<div class="cal-cap">' +
          '<p class="cal-luna">' + LUNI[luna] + " <span>" + an + "</span></p>" +
          '<div class="cal-nav">' +
          '<button type="button" class="cal-inapoi" aria-label="Luna anterioară"' +
          (chCurent <= chMin ? " disabled" : "") + ">&#8249;</button>" +
          '<button type="button" class="cal-inainte" aria-label="Luna următoare"' +
          (chCurent >= chMax ? " disabled" : "") + ">&#8250;</button>" +
          "</div></div>";

        h += '<div class="cal-zile" aria-hidden="true">' +
          INITIALE.map(function (z) {
            return '<span title="' + z[1] + '">' + z[0] + "</span>";
          }).join("") + "</div>";

        // grila începe de luni
        var decalaj = (new Date(an, luna, 1).getDay() + 6) % 7;
        var zile = new Date(an, luna + 1, 0).getDate();
        h += '<div class="cal-grila">';
        for (var g = 0; g < decalaj; g++) h += '<span class="cal-zi gol"></span>';
        for (var zi = 1; zi <= zile; zi++) {
          var mz = inLuna[zi];
          if (!mz) { h += '<span class="cal-zi">' + zi + "</span>"; continue; }
          h += '<button type="button" class="cal-zi meci" aria-label="' +
            mz.adversar + ", " + zi + " " + LUNI_SCURT[luna] + '">' +
            BALON + (mz.acasa ? STADION : AVION) +
            '<span class="cal-info"><b>' + mz.adversar + "</b><span>" +
            (mz.acasa ? "Acasă" : "Deplasare") + " · " +
            ZILE_SCURT[mz.ziSapt] + " " + mz.zi + " " + LUNI_SCURT[luna] +
            ", " + mz.ora + "</span></span></button>";
        }
        // completăm ultimul rând, ca linia grilei să nu se rupă la jumătate
        var rest = (decalaj + zile) % 7;
        if (rest) {
          for (var k = rest; k < 7; k++) h += '<span class="cal-zi gol"></span>';
        }
        h += "</div>";
        radacina.innerHTML = h;

        var inapoi = radacina.querySelector(".cal-inapoi");
        var inainte = radacina.querySelector(".cal-inainte");
        inapoi.addEventListener("click", function () { chCurent--; deseneaza(); });
        inainte.addEventListener("click", function () { chCurent++; deseneaza(); });

        // pe touch nu există hover: un tap deschide eticheta, altul o închide
        radacina.querySelectorAll(".cal-zi.meci").forEach(function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var era = b.classList.contains("activ");
            radacina.querySelectorAll(".cal-zi.activ").forEach(function (x) {
              x.classList.remove("activ");
            });
            if (!era) b.classList.add("activ");
          });
        });
      }

      document.addEventListener("click", function () {
        radacina.querySelectorAll(".cal-zi.activ").forEach(function (x) {
          x.classList.remove("activ");
        });
      });

      deseneaza();
      paralax();
    })
    .catch(function () { radacina.style.display = "none"; });
})();
