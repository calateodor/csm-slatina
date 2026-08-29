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

    // Hero-ul conține două imagini mari, iar înălțimea lui se schimbă când
    // ele se încarcă. ScrollTrigger își fixează reperele la construcție, deci
    // fără reîmprospătare toate cursele rămân decalate — se consumau înainte
    // ca secțiunea să ajungă pe ecran. Recalculăm după fiecare imagine.
    function reimprospateaza() { ScrollTrigger.refresh(); }
    window.addEventListener("load", reimprospateaza);
    erou.querySelectorAll("img").forEach(function (im) {
      if (im.complete) return;
      im.addEventListener("load", reimprospateaza);
      im.addEventListener("error", reimprospateaza);
    });

    // Toate amplitudinile vin din css/erou-fotbal.css, ca reglajele să stea
    // într-un singur loc. Cu cât un strat rămâne mai mult în urmă (număr
    // pozitiv mai mare), cu atât pare mai departe.
    var stil = getComputedStyle(erou);
    function maneta(nume, implicit) {
      var n = parseFloat(stil.getPropertyValue(nume));
      return isNaN(n) ? implicit : n;
    }
    var pe = { trigger: erou, start: "top top", end: "bottom top", scrub: 0.5 };

    // planul cel mai adânc: tribuna
    var fundal = erou.querySelector(".erou-fundal img");
    if (fundal) {
      gsap.to(fundal, { yPercent: maneta("--px-fundal", 24), ease: "none", scrollTrigger: pe });
    }
    // banda deschisă de sub diagonală: plan intermediar. Se mișcă prin
    // variabilă, nu prin transform, ca înclinarea de 15,1° să rămână intactă,
    // și în pixeli, fiindcă blocul e mult mai înalt decât secțiunea.
    var taiere = document.querySelector(".erou-taietura");
    if (taiere && poza) {
      gsap.to(taiere, {
        "--taiere-y": function () {
          return (poza.offsetHeight * maneta("--px-banda", 14) / 100).toFixed(1) + "px";
        },
        ease: "none", scrollTrigger: pe
      });
    }
    // jucătorii: planul cel mai apropiat, deci rămân cel mai puțin în urmă
    if (poza) {
      gsap.to(poza, {
        yPercent: maneta("--px-jucatori", 7), scale: 1.05,
        transformOrigin: "50% 100%", ease: "none", scrollTrigger: pe
      });
    }
    // calendarul și textul urcă și se sting pe măsură ce ies pe sus: cursa e
    // legată de elementul însuși, nu de secțiune, altfel s-ar decolora cât
    // sunt încă întregi pe ecran
    // fromTo, nu to: la incarcarea paginii ruleaza si intrarea in cascada
    // (CSS), care tine o clipa opacitatea la 0. Un simplu .to() ar citi acel
    // 0 drept valoare de pornire si ar bloca calendarul invizibil dupa
    // terminarea intrarii. Startul explicit pe 1 il face imun la ordinea lor.
    gsap.fromTo(radacina, { opacity: 1 }, {
      yPercent: maneta("--px-calendar", -30), opacity: 0, ease: "none",
      scrollTrigger: { trigger: radacina, start: "top top", end: "bottom top", scrub: 0.5 }
    });
    if (text) {
      gsap.to(text, {
        yPercent: maneta("--px-text", -60), opacity: 0, ease: "none",
        scrollTrigger: { trigger: text, start: "top top", end: "bottom top", scrub: 0.5 }
      });
    }
    // Secțiunea de dedesubt alunecă peste erou, ca o foaie care îl acoperă.
    // CSS-ul i-a dat o margine negativă cât suprapunerea dorită; aici o
    // pornim coborâtă exact cu atât, deci la început e lipită de erou, fără
    // gol, iar pe cursa de scroll urcă și îi acoperă ultima fâșie. Măsurăm
    // în pixeli, la fiecare refresh, ca să urmeze înălțimea ferestrei.
    var urmatoare = erou.nextElementSibling;
    if (urmatoare) {
      function cursaFoii() {
        return maneta("--px-urmatoare", 14) * window.innerHeight / 100;
      }
      var declansatorFoaie = {
        trigger: urmatoare, start: "top bottom", end: "top 40%",
        scrub: 0.5, invalidateOnRefresh: true
      };
      gsap.fromTo(urmatoare, { y: cursaFoii },
        { y: 0, ease: "none", scrollTrigger: declansatorFoaie });

      // Filigranul FOTBAL și gheata urcă prinse de foaie: același declanșator,
      // aceeași cursă în pixeli, doar că ele pornesc de la locul lor și se
      // ridică, în loc să coboare spre zero. Rezultatul e că distanța dintre
      // ele și muchia albă rămâne constantă — par lipite de secțiune.
      var prinseDeFoaie = [erou.querySelector(".sport-ghost"),
                           erou.querySelector(".hero-art")].filter(Boolean);
      prinseDeFoaie.forEach(function (el) {
        // filigranul e centrat cu translateY(-50%) din CSS; îl trecem explicit
        // în yPercent, altfel GSAP citește procentul ca pixeli din matrice și
        // elementul sare din poziție la prima animare a lui y
        if (el.classList.contains("sport-ghost")) {
          gsap.set(el, { yPercent: -50, y: 0 });
        }
        gsap.to(el, {
          y: function () { return -cursaFoii(); },
          ease: "none",
          scrollTrigger: {
            trigger: urmatoare, start: "top bottom", end: "top 40%",
            scrub: 0.5, invalidateOnRefresh: true
          }
        });
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
        // --i e rangul celulei in grila; CSS-ul il foloseste ca intarziere,
        // ca lumina sa treaca peste calendar ca un val, nu deodata
        var i = 0;
        h += '<div class="cal-grila">';
        for (var g = 0; g < decalaj; g++) h += '<span class="cal-zi gol" style="--i:' + (i++) + '"></span>';
        for (var zi = 1; zi <= zile; zi++) {
          var mz = inLuna[zi];
          if (!mz) { h += '<span class="cal-zi" style="--i:' + (i++) + '">' + zi + "</span>"; continue; }
          h += '<button type="button" style="--i:' + (i++) + '" class="cal-zi meci" aria-label="' +
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
          for (var k = rest; k < 7; k++) h += '<span class="cal-zi gol" style="--i:' + (i++) + '"></span>';
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
      // Intrarea in cascada porneste abia acum, cand calendarul chiar exista
      // (pana aici s-a asteptat echipe.json). Clasa se scoate dupa ce se
      // termina valul, altfel schimbarea lunii ar reaprinde grila de fiecare
      // data — un efect frumos o data, obositor la a treia apasare.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        radacina.classList.add("cal-intra");
        setTimeout(function () { radacina.classList.remove("cal-intra"); }, 1600);
      }
      // calendarul umplut schimba inaltimea hero-ului: re-masuram cursele
      if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
    })
    .catch(function () { radacina.style.display = "none"; });

  // Parallax-ul porneste IMEDIAT, nu dupa descarcarea lui echipe.json:
  // altfel, o derulare in prima jumatate de secunda gasea straturile fara
  // animatii, iar cand soseau datele totul sarea brusc la pozitia derulata.
  paralax();
})();
