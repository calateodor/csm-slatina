/* =========================================================
   Sezonul în curs + Lotul echipei — fotbal / handbal (v2)
   Construiește din data/echipe.json (generat de
   scripts/actualizeaza-echipe.py):
   - rezultate recente + program + forma echipei;
   - lotul ca un evantai 3D de carduri (stil „explore places"):
     cardul activ mare, color, în față; celelalte mai mici,
     desaturate, parțial în spatele lui. Drag cu inerție,
     click deschide, fișă de sticlă compactă cu „detalii".
   - sub deck, terenul cu toate posturile: cel activ aprins.
   ========================================================= */
(function () {
  "use strict";

  var radacina = document.getElementById("lot-app");
  var sezonEl = document.getElementById("sezon-grid");
  if (!radacina && !sezonEl) return;
  var sport = (radacina || sezonEl).getAttribute("data-sport") || "fotbal";
  var areGsap = typeof gsap !== "undefined";

  var LUNI = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
  function dataScurta(ts) {
    var d = new Date(ts * 1000);
    return d.getDate() + " " + LUNI[d.getMonth()] + "<br>" +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function initiale(nume) {
    return nume.split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ""; }).join("").toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // Flashscore listează „Nume Prenume", Wikipedia „Prenume Nume"
  function parteNume(juc) {
    var p = juc.nume.split(/\s+/);
    if (p.length < 2) return { prenume: "", familie: juc.nume };
    if (sport === "fotbal") return { prenume: p.slice(1).join(" "), familie: p[0] };
    return { prenume: p.slice(0, -1).join(" "), familie: p[p.length - 1] };
  }
  var STAT_SCURT = [
    ["Meciuri jucate", "Meciuri"],
    ["Goluri marcate", "Goluri"],
    ["Pase decisive", "Pase gol"],
    ["Procentaj intervenții", "Interv."],
    ["Fără gol", "Fără gol"],
    ["Cartonașe galbene", "Galbene"],
    ["Cartonașe roșii", "Roșii"],
    ["Rating", "Rating"]
  ];

  function numeIngrosat(nume) {
    return nume.indexOf("CSM Slatina") === 0 ? "<b>" + esc(nume) + "</b>" : esc(nume);
  }

  fetch("../data/echipe.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (toate) {
      var e = toate[sport];
      if (!e) return;
      (e.lot || []).forEach(function (j) { j.post = postNormal(j.post); });
      if (sezonEl) deseneazaSezon(e);
      if (radacina && e.lot && e.lot.length) deseneazaLot(e);
    })
    .catch(function () { /* fără date, secțiunile rămân goale */ });

  /* ================= Sezonul ================= */
  function deseneazaSezon(e) {
    var h = '<div class="sezon-panou">';
    h += '<div class="sezon-cap"><span class="competitie">' + esc(e.competitie) + "</span>";
    if (e.forma) {
      h += '<span class="forma" title="Ultimele 5 meciuri">' +
        e.forma.split("").map(function (l) { return '<i class="' + l + '">' + l + "</i>"; }).join("") +
        "</span>";
    }
    h += "</div>";
    h += '<div class="sezon-coloane"><div><h3>Rezultate recente</h3>';
    (e.rezultate || []).slice(0, 5).forEach(function (m) {
      h += '<div class="meci-rand"><span class="data">' + dataScurta(m.timestamp) + "</span>" +
        '<span class="echipe">' + numeIngrosat(m.gazde) + " – " + numeIngrosat(m.oaspeti) + "</span>" +
        '<span class="scor">' + m.scor[0] + ":" + m.scor[1] + "</span>" +
        '<span class="insigna ' + m.forma + '">' + m.forma + "</span></div>";
    });
    h += "</div><div><h3>Urmează</h3>";
    (e.program || []).slice(0, 5).forEach(function (m) {
      h += '<div class="meci-rand"><span class="data">' + dataScurta(m.timestamp) + "</span>" +
        '<span class="echipe">' + numeIngrosat(m.gazde) + " – " + numeIngrosat(m.oaspeti) + "</span>" +
        '<span class="loc ' + (m.acasa ? "acasa" : "") + '">' + (m.acasa ? "acasă" : "depl.") + "</span></div>";
    });
    h += "</div></div>";
    h += '<p class="sezon-sursa">date actualizate automat · <a href="' + esc(e.flashscore) +
      '" target="_blank" rel="noopener">program complet →</a></p></div>';
    sezonEl.innerHTML = h;
  }

  /* ================= Lotul ================= */
  var GRUPE_FOTBAL = ["Portar", "Fundaș", "Mijlocaș", "Atacant"];
  /* ordinea din afișul oficial al echipei, de la poartă spre linia de 9m:
     portar, extreme, pivoți, interi, centru */
  var GRUPE_HANDBAL = ["Portar", "Extremă stânga", "Extremă dreapta", "Pivot", "Inter stânga", "Inter dreapta", "Centru"];
  /* datele mai vechi (sau panoul) pot spune încă „Coordonator”: e același post */
  function postNormal(p) { return p === "Coordonator" ? "Centru" : p; }

  // toate posturile posibile, cu coordonatele lor pe teren (% din teren)
  function posturiTeren() {
    if (sport === "handbal") {
      /* Poarta e în stânga desenului, deci atacantele privesc spre stânga:
         „stânga” lor e JOSUL desenului, „dreapta” lor e SUSUL — exact ca
         în afișul oficial, unde poarta e sus și extrema stângă e în stânga.
         Pivotul stă pe linia de 6m, interii pe 9m, centrul cel mai departe. */
      return [
        ["Portar", 6, 50], ["Extremă dreapta", 22, 12], ["Extremă stânga", 22, 88],
        ["Pivot", 30, 50], ["Inter dreapta", 48, 22], ["Inter stânga", 48, 78],
        ["Centru", 62, 50]
      ];
    }
    return [["Portar", 8, 50], ["Fundaș", 30, 50], ["Mijlocaș", 55, 50], ["Atacant", 79, 50]];
  }

  function terenSvg() {
    var schita;
    if (sport === "handbal") {
      // jumătatea de atac a terenului de handbal: semicercurile de 6m și 9m
      schita = '<rect class="gazon" x="6" y="6" width="388" height="208" rx="14"/>' +
        '<path class="linii" d="M6 62 A 96 96 0 0 1 6 158 M6 30 A 152 152 0 0 1 6 190"/>' +
        '<line class="linii" x1="394" y1="6" x2="394" y2="214"/>' +
        '<rect class="linii" x="2" y="88" width="7" height="44"/>';
    } else {
      schita = '<rect class="gazon" x="6" y="6" width="388" height="208" rx="14"/>' +
        '<line class="linii" x1="200" y1="6" x2="200" y2="214"/>' +
        '<circle class="linii" cx="200" cy="110" r="34"/>' +
        '<rect class="linii" x="6" y="55" width="56" height="110"/>' +
        '<rect class="linii" x="338" y="55" width="56" height="110"/>' +
        '<rect class="linii" x="6" y="86" width="22" height="48"/>' +
        '<rect class="linii" x="372" y="86" width="22" height="48"/>';
    }
    var puncte = posturiTeren().map(function (p) {
      var x = 6 + (p[1] / 100) * 388, y = 6 + (p[2] / 100) * 208;
      return '<g class="post-punct" data-post="' + esc(p[0]) + '" transform="translate(' + x + "," + y + ')">' +
        '<circle class="p-disc" r="7"/>' +
        '<text class="p-nume" y="21">' + esc(p[0]) + "</text></g>";
    }).join("");
    return '<svg viewBox="0 0 400 230" aria-hidden="true">' + schita + puncte +
      '<g id="lot-marcaj"><circle class="lot-halo" r="14" stroke-width="2"/></g></svg>';
  }

  // conținutul static al fiecărui card
  function cardHtml(juc) {
    var np = parteNume(juc);
    var h = "";
    if (juc.poza) h += '<img src="../' + esc(juc.poza) + '" alt="' + esc(juc.nume) + '" loading="lazy">';
    h += '<div class="j-veil"></div>';
    // numărul în colț, ca „01" din referință
    h += '<b class="j-nr">' + (juc.numar != null ? juc.numar : "&nbsp;") + "</b>";
    // numele pe verticală, ca fâșiile de la Plaja Olt
    h += '<span class="j-vert">' +
      (np.prenume ? "<i>" + esc(np.prenume) + "</i>" : "") +
      "<b>" + esc(np.familie) + "</b></span>";
    h += '<span class="j-fantoma">' + (juc.numar != null ? juc.numar : esc(initiale(juc.nume))) + "</span>";

    // fișa de sticlă, compactă (max jumătatea de jos a cardului)
    h += '<div class="j-copy"><div class="j-sticla">';
    h += '<div class="g-cap"><div><p class="g-prenume">' + esc(np.prenume || "&nbsp;") + "</p>" +
      '<h3 class="g-nume">' + esc(np.familie) + "</h3></div>" +
      '<span class="j-post">' + esc(juc.post) + "</span></div>";

    var masuri = [];
    if (juc.inaltime) {
      masuri.push('<span class="masura"><b>' +
        (juc.inaltime / 100).toFixed(2).replace(".", ",") + "<small>m</small></b><i>Înălțime</i></span>");
    }
    if (juc.greutate) masuri.push('<span class="masura"><b>' + juc.greutate + "<small>kg</small></b><i>Greutate</i></span>");
    if (juc.varsta) masuri.push('<span class="masura"><b>' + juc.varsta + "<small>ani</small></b><i>Vârstă</i></span>");
    if (juc.cariera && juc.cariera.sezoane > 1) {
      masuri.push('<span class="masura"><b>' + juc.cariera.sezoane + "<small>sez.</small></b><i>Experiență</i></span>");
    }
    if (masuri.length) h += '<div class="g-masuri">' + masuri.join("") + "</div>";

    var statCols = [];
    if (juc.stats) {
      STAT_SCURT.forEach(function (per) {
        juc.stats.forEach(function (st) {
          if (st[0] === per[0] && statCols.length < 4) {
            statCols.push('<span class="jstat"><i>' + per[1] + "</i><b>" + esc(st[1]) + "</b></span>");
          }
        });
      });
    }
    if (statCols.length) {
      h += '<div class="g-stats"><span class="g-eticheta">Sezon<br><b>' +
        esc((juc.sezonStats || "").replace("/20", "/")) + "</b></span>" + statCols.join("") + "</div>";
    }

    // restul datelor, desfășurate din butonul „detalii"
    var fise = [];
    if (juc.nascut) fise.push(["Născut", juc.nascut]);
    if (juc.origine) fise.push(["De unde", juc.origine]);
    fise.push(["Naționalitate", juc.nat]);
    if (juc.valoare) fise.push(["Valoare de piață", juc.valoare]);
    if (juc.cariera && juc.cariera.debut) fise.push(["Debut senior", juc.cariera.debut]);
    var rest = '<div class="g-fise">' + fise.map(function (f) {
      return '<span class="fisa"><i>' + f[0] + "</i><b>" + esc(f[1]) + "</b></span>";
    }).join("") + "</div>";
    if (juc.cariera && (juc.cariera.meciuri || juc.cariera.goluri)) {
      var c = juc.cariera, parti = [];
      if (c.meciuri) parti.push("<b>" + esc(c.meciuri) + "</b> meciuri");
      if (c.goluri) parti.push("<b>" + esc(c.goluri) + "</b> goluri");
      if (c.pase) parti.push("<b>" + esc(c.pase) + "</b> pase dec.");
      if (c.faraGol) parti.push("<b>" + esc(c.faraGol) + "</b> fără gol");
      if (c.debut) parti.push("din <b>" + c.debut + "</b>");
      rest += '<p class="g-cariera"><i>Carieră</i>' + parti.join(" · ") + "</p>";
    }
    // creditul pozei (pozaCredit) ramane in echipe.json, dar nu se mai
    // afiseaza pe card — la cererea clubului

    h += '<button class="g-mai" type="button" aria-expanded="false">Detalii <b>+</b></button>';
    h += '<div class="g-rest"><div>' + rest + "</div></div>";
    h += "</div></div>";
    // dunga de lucire care traversează cardul după mouse (doar pe desktop)
    h += '<i class="j-lucire" aria-hidden="true"></i>';
    return h;
  }

  function deseneazaLot(e) {
    var lot = e.lot;
    var grupe = (sport === "handbal" ? GRUPE_HANDBAL : GRUPE_FOTBAL)
      .filter(function (g) { return lot.some(function (p) { return p.post === g; }); });

    var h = '<div class="lot-panou">' +
      '<div class="lot-scena" id="lot-scena"></div>' +
      // carma: inlocuieste scrollbar-ul nativ — un cerc de tras pe o sina
      // cu progres auriu; sagetile sunt si butoane (card anterior/urmator)
      '<div class="lot-carma">' +
        '<div class="carma-sina"><span class="carma-progres"></span>' +
        '<button type="button" class="carma-cerc" aria-label="Trage stânga-dreapta pentru a parcurge lotul"></button></div>' +
      "</div>" +
      '<div class="lot-variante" role="group" aria-label="Stilul evantaiului"></div>' +
      '<div class="lot-teren-wrap"><h4>Poziția pe teren</h4>' +
      '<div class="lot-teren">' + terenSvg() + "</div></div>";
    if (e.sursaLot) h += '<p class="lot-sursa">lot conform: ' + esc(e.sursaLot) + "</p>";
    h += "</div>";
    radacina.innerHTML = h;

    var scena = document.getElementById("lot-scena");
    var carduri = [];
    // ordinea rămâne pe posturi (portari, apoi restul), de la stânga la dreapta
    grupe.forEach(function (g) {
      lot.forEach(function (juc) {
        if (juc.post !== g) return;
        var c = document.createElement("article");
        c.className = "jcard" + (juc.poza ? " are-poza" : "");
        c.innerHTML = cardHtml(juc);
        c.addEventListener("click", function (ev) {
          if (scena.dataset.tras === "1") return; // a fost drag, nu click
          if (!c.classList.contains("deschis")) alege(juc, c, true);
        });
        var btn = c.querySelector(".g-mai");
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var extins = c.classList.toggle("extins");
          btn.setAttribute("aria-expanded", extins ? "true" : "false");
          btn.innerHTML = extins ? "Mai puțin <b>–</b>" : "Detalii <b>+</b>";
        });
        scena.appendChild(c);
        carduri.push({ juc: juc, el: c });
      });
    });
    // coada scenei: loc gol dupa ultimul card; latimea o da asiguraCoada()
    var coada = document.createElement("span");
    coada.className = "lot-coada";
    coada.setAttribute("aria-hidden", "true");
    scena.appendChild(coada);

    var marcaj = radacina.querySelector("#lot-marcaj");
    var puncte = Array.prototype.slice.call(radacina.querySelectorAll(".post-punct"));

    // tilt 3D după mouse + parallax pe fotografie (doar unde există hover real)
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      carduri.forEach(function (c) {
        var el = c.el, img = el.querySelector("img");
        var luc = el.querySelector(".j-lucire");
        el.addEventListener("mousemove", function (ev) {
          var r = el.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width - 0.5;
          var py = (ev.clientY - r.top) / r.height - 0.5;
          el.style.setProperty("--my", (px * 6).toFixed(2) + "deg");
          el.style.setProperty("--mx", (-py * 4).toFixed(2) + "deg");
          if (img) {
            img.style.setProperty("--pax", (px * -12).toFixed(1) + "px");
            img.style.setProperty("--pay", (py * -9).toFixed(1) + "px");
          }
          if (luc) {
            luc.style.setProperty("--lux", px.toFixed(3));
            luc.style.setProperty("--luy", py.toFixed(3));
          }
        });
        el.addEventListener("mouseleave", function () {
          el.style.removeProperty("--my");
          el.style.removeProperty("--mx");
          if (img) {
            img.style.removeProperty("--pax");
            img.style.removeProperty("--pay");
          }
          if (luc) {
            luc.style.removeProperty("--lux");
            luc.style.removeProperty("--luy");
          }
        });
      });
    }

    // drag cu inerție prin deck (mouse; pe touch rămâne scroll-ul nativ cu
    // momentum). Apăsările pe scrollbar sunt lăsate în întregime browserului.
    (function () {
      var jos = false, aTras = false, x0 = 0, s0 = 0, xUltim = 0, tUltim = 0, vx = 0;
      scena.addEventListener("pointerdown", function (ev) {
        if (ev.pointerType !== "mouse" || ev.button !== 0) return;
        // scrollbar-ul stă în afara zonei de conținut — acolo nu pornim drag
        if (ev.offsetY >= scena.clientHeight || ev.offsetX >= scena.clientWidth) return;
        jos = true; aTras = false;
        x0 = xUltim = ev.clientX; s0 = scena.scrollLeft;
        tUltim = performance.now(); vx = 0;
        if (areGsap) gsap.killTweensOf(scena);
      });
      window.addEventListener("pointermove", function (ev) {
        if (!jos) return;
        var dx = ev.clientX - x0;
        if (!aTras && Math.abs(dx) > 6) {
          aTras = true;
          scena.dataset.tras = "1";
          scena.classList.add("trage");
        }
        if (aTras) {
          scena.scrollLeft = s0 - dx;
          var acum = performance.now();
          if (acum - tUltim > 12) {
            vx = (ev.clientX - xUltim) / (acum - tUltim); // px pe ms
            xUltim = ev.clientX; tUltim = acum;
          }
          ev.preventDefault();
        }
      });
      window.addEventListener("pointerup", function () {
        if (!jos) return;
        jos = false;
        scena.classList.remove("trage");
        if (aTras) {
          // Aruncarea nu se mai opreste oriunde: calculam unde ar ajunge
          // inertia, apoi rotunjim tinta la pozitia de odihna a celui mai
          // apropiat card. Asa nimic nu ramane agatat pe muchia de taiere —
          // dupa fiecare gest, cardul deschis sta intreg, la locul lui.
          if (areGsap) {
            var brut = scena.scrollLeft - vx * 320;
            gsap.to(scena, {
              scrollLeft: tintaPeCard(brut),
              duration: Math.abs(vx) > 0.15 ? 0.8 : 0.45,
              ease: "power2.out"
            });
          }
          // lasă click-ul curent să fie ignorat, apoi rearmă
          setTimeout(function () { delete scena.dataset.tras; }, 60);
        }
      });
    })();

    // pozitia de odihna (scroll) a celui mai apropiat card fata de un scroll dat
    function tintaPeCard(brut) {
      var maxim = scena.scrollWidth - scena.clientWidth;
      brut = Math.max(0, Math.min(maxim, brut));
      var tinta = 0, dMin = Infinity;
      for (var i = 0; i < pozitii.length; i++) {
        var o = Math.min(maxim, Math.max(0, pozitii[i] - ANCORA));
        var d = Math.abs(o - brut);
        if (d < dMin) { dMin = d; tinta = o; }
      }
      return tinta;
    }

    /* ---------- carma: cercul de tras care inlocuieste scrollbar-ul ----------
       Pozitia cercului oglindeste scrollLeft; tragerea lui scrie scrollLeft
       (aceeasi banda, alt maner). La eliberare se aseaza pe un card, ca si
       drag-ul direct. Sagetile sunt butoane: un card inapoi / inainte. */
    (function () {
      var carma = radacina.querySelector(".lot-carma");
      var sina = carma && carma.querySelector(".carma-sina");
      var cerc = carma && carma.querySelector(".carma-cerc");
      var progres = carma && carma.querySelector(".carma-progres");
      if (!carma || !sina || !cerc) return;

      function maxScroll() { return Math.max(1, scena.scrollWidth - scena.clientWidth); }
      function cursa() { return Math.max(1, sina.clientWidth - cerc.offsetWidth); }

      var rafCarma = null;
      function oglindeste() {
        rafCarma = null;
        var f = Math.max(0, Math.min(1, scena.scrollLeft / maxScroll()));
        var x = f * cursa();
        cerc.style.transform = "translateX(" + x.toFixed(1) + "px)";
        // scaleX in loc de width: transformarea se compune pe GPU, latimea ar
        // forta layout la fiecare cadru de derulare
        if (progres) progres.style.transform = "scaleX(" + f.toFixed(4) + ")";
      }
      scena.addEventListener("scroll", function () {
        if (!rafCarma) rafCarma = requestAnimationFrame(oglindeste);
      }, { passive: true });
      window.addEventListener("resize", oglindeste);
      oglindeste();

      var tragere = false, aMiscat = false, x0 = 0, s0 = 0;
      cerc.addEventListener("pointerdown", function (ev) {
        tragere = true; aMiscat = false;
        x0 = ev.clientX; s0 = scena.scrollLeft;
        cerc.setPointerCapture(ev.pointerId);
        carma.classList.add("in-tragere");
        if (areGsap) gsap.killTweensOf(scena);
        ev.preventDefault();
      });
      cerc.addEventListener("pointermove", function (ev) {
        if (!tragere) return;
        var dx = ev.clientX - x0;
        if (Math.abs(dx) > 4) aMiscat = true;
        scena.scrollLeft = s0 + dx * (maxScroll() / cursa());
      });
      cerc.addEventListener("pointerup", function (ev) {
        if (!tragere) return;
        tragere = false;
        carma.classList.remove("in-tragere");
        if (aMiscat) {
          if (areGsap) {
            gsap.to(scena, { scrollLeft: tintaPeCard(scena.scrollLeft), duration: 0.45, ease: "power2.out" });
          } else {
            scena.scrollLeft = tintaPeCard(scena.scrollLeft);
          }
        }
      });
    })();

    /* Derularea (swipe, drag, rotiță, scrollbar) selectează cardurile unul
       câte unul: cardul ajuns în dreptul ancorei se deschide complet, cu fișă
       și teren actualizat. E stabil pentru că deschiderea nu schimbă amprenta
       de layout a cardului (marginea negativă absoarbe surplusul de lățime),
       deci nimic nu se mișcă sub degetul utilizatorului și nu e nimic de
       compensat. */
    // Ancora: unde se aseaza cardul deschis, masurata de la inceputul
    // continutului. Egala cu paddingul scenei, deci cardul odihnit sta
    // aliniat cu titlul sectiunii, nu agatat de muchia ecranului.
    var ANCORA = 16;
    function masoaraAncora() {
      ANCORA = parseFloat(getComputedStyle(scena).paddingLeft) || 16;
    }
    masoaraAncora();
    window.addEventListener("resize", masoaraAncora);

    /* Coada scenei. Fara ea, scrollul isi atinge maximul cand marginea
       dreapta a filei ajunge la ecran, asa ca ultimele carduri nu mai pot
       ajunge in dreptul ancorei: carma si derularea se opreau cu vreo zece
       carduri inainte de final. Masuram din layoutul real exact cat loc gol
       ii lipseste ultimului card ca sa se poata aseza si el la ancora. */
    function asiguraCoada() {
      if (!carduri.length) return;
      coada.style.width = "0px";
      var ultim = carduri[carduri.length - 1].el;
      var lipsa = ultim.offsetLeft - ANCORA + scena.clientWidth - scena.scrollWidth;
      coada.style.width = Math.max(0, Math.ceil(lipsa)) + "px";
    }
    asiguraCoada();
    window.addEventListener("resize", asiguraCoada);
    var blocatDeCamera = false, rafFocal = null;
    var idxDeschis = 0;

    /* Pozițiile din layout sunt constante prin construcție (amprenta unui card
       nu se schimbă la deschidere), deci le citim o singură dată și le
       refolosim — altfel fiecare cadru de derulare ar forța un layout. */
    var pozitii = [];
    var latimi = [];
    var impMax = 0;
    function masoaraPozitii() {
      pozitii = carduri.map(function (c) { return c.el.offsetLeft; });
      latimi = carduri.map(function (c) { return c.el.offsetWidth; });
      impMax = parseFloat(getComputedStyle(scena).getPropertyValue("--imp-max")) || 0;
    }
    masoaraPozitii();
    window.addEventListener("resize", masoaraPozitii);

    function indexFocal() {
      var x = scena.scrollLeft + ANCORA;
      var best = 0, bestD = Infinity;
      for (var i = 0; i < pozitii.length; i++) {
        var d = Math.abs(pozitii[i] - x);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    // stiva 3D: adâncimi logaritmice în jurul centrului, plus împingerea
    // fâșiilor de după cardul deschis, ca acesta să nu le acopere
    function aplicaAdancimi(centru) {
      carduri.forEach(function (c, i) {
        var dist = Math.abs(i - centru);
        // rotunjite, valorile cardurilor îndepărtate nu se schimbă între
        // selecții, deci nu le mai rescriem stilul degeaba
        var ad = (1 - Math.pow(0.78, dist)).toFixed(2);
        var z = String(80 - Math.min(dist, 60));
        var imp = i > centru ? "1" : "0";
        if (c.ad !== ad) { c.ad = ad; c.el.style.setProperty("--ad", ad); }
        if (c.z !== z) { c.z = z; c.el.style.setProperty("--z", z); }
        if (c.imp !== imp) { c.imp = imp; c.el.style.setProperty("--imp", imp); }
        c.el.classList.toggle("focal", i === centru);
      });
    }

    /* Estomparea la margini: cardul intreg paleste pe ultimii STINGERE pixeli
       ai ferestrei, in loc sa fie retezat de muchie. Doar opacitate — se
       compune pe GPU, fara re-randarea scenei (masca de container sacada).
       Cardul deschis e mereu plin: abia cand alt card ii ia locul intra si el
       in regim normal, iar tranzitia din CSS face trecerea moale. */
    var rafEstompare = null;
    function estompeaza() {
      aplicaCurba();
      // 120px pe desktop; pe fasii inguste (telefon) scade proportional,
      // altfel doua treimi din scena ar sta mereu in penumbra
      var STINGERE = Math.min(120, scena.clientWidth * 0.16);
      var st = scena.scrollLeft;
      var dr = st + scena.clientWidth;
      for (var i = 0; i < carduri.length; i++) {
        var c = carduri[i];
        if (c.el.classList.contains("deschis")) {
          c.opTinta = 1;
        } else {
          // pozitia vizuala: amprenta din layout plus impingerea de dupa
          // cardul deschis (translateX-ul din CSS)
          var L = pozitii[i] + (c.imp === "1" ? impMax : 0);
          var R = L + latimi[i];
          c.opTinta = Math.max(0, Math.min(1, (R - st) / STINGERE, (dr - L) / STINGERE));
        }
      }
      if (!rafEstompare) rafEstompare = requestAnimationFrame(lerpuieste);
    }
    // opacitatea curge spre tinta cu un sfert din diferenta pe cadru: la
    // derulare urmeaza degetul aproape instant, iar cand un card pierde locul
    // din fata alunecarea spre palid dureaza cateva zecimi, nu e o saritura
    function lerpuieste() {
      rafEstompare = null;
      var agitat = false;
      for (var i = 0; i < carduri.length; i++) {
        var c = carduri[i];
        if (c.op === undefined) c.op = 1;
        var dif = c.opTinta - c.op;
        if (Math.abs(dif) > 0.01) { c.op += dif * 0.25; agitat = true; }
        else if (c.op !== c.opTinta) { c.op = c.opTinta; }
        // scriem in pasi de 0.04: destul de fin cat sa para continuu, destul
        // de rar cat sa nu invalidam compozitia cardului la fiecare cadru
        var scris = c.op >= 0.995 ? "" : (Math.round(c.op * 25) / 25).toFixed(2);
        if (c.opScris !== scris) {
          c.opScris = scris;
          c.el.style.opacity = scris;
        }
      }
      if (agitat) rafEstompare = requestAnimationFrame(lerpuieste);
    }

    function laDerulare() {
      rafFocal = null;
      estompeaza();
      if (blocatDeCamera) return;
      var idx = indexFocal();
      if (idx !== idxDeschis) {
        var c = carduri[idx];
        alege(c.juc, c.el, false);
        estompeaza();
      }
    }

    scena.addEventListener("scroll", function () {
      if (!rafFocal) rafFocal = requestAnimationFrame(laDerulare);
    }, { passive: true });
    window.addEventListener("resize", function () { estompeaza(); });
    estompeaza();

    /* ---------- experiment v3-cards: linia orizontului ----------
       Evantaiul e deja o scena 3D: cardurile se adancesc cu translateZ, iar
       punctul de fuga al perspectivei (perspective-origin) stabileste unde
       converg liniile. Din fabrica orizontul taie randul prin mijloc; aici il
       ridicam spre partea de sus a cardurilor (schita lui Teo: baza cardurilor
       urca pe masura ce se departeaza, varfurile coboara abia sesizabil — doua
       arce, ca la un drum care fuge spre zare).
         v1 Orizont — orizontul urcat la ~75% din inaltimea cardului;
         v2 Adanc   — acelasi orizont + recesiune mai adanca (cardurile se
                      micsoreaza mai hotarat spre coada);
         v3 Colt    — punctul de fuga tras spre cardul deschis: randul fuge
                      spre coltul din stanga-sus, cu o rasucire jucausa.
       Alegerea sta in localStorage; dupa decizie, se scoate comutatorul. */
    var VARIANTE_CURBA = [
      ["v0", "Drept",   { ox: "50%", oy: "50%", adancf: 1,    rot: 0 }],
      ["v1", "Orizont", { ox: "50%", oy: "22%", adancf: 1,    rot: 0 }],
      ["v2", "Adânc",   { ox: "46%", oy: "18%", adancf: 1.55, rot: 0 }],
      ["v3", "Colț",    { ox: "26%", oy: "16%", adancf: 1.35, rot: 2.6 }]
    ];
    var gazdaVariante = radacina.querySelector(".lot-variante");
    var curba;
    try {
      curba = new URLSearchParams(location.search).get("carduri") || localStorage.getItem("lot_curba");
    } catch (e) {}
    if (VARIANTE_CURBA.every(function (v) { return v[0] !== curba; })) curba = "v0";

    function profilCurba() {
      for (var i = 0; i < VARIANTE_CURBA.length; i++) {
        if (VARIANTE_CURBA[i][0] === curba) return VARIANTE_CURBA[i][2];
      }
      return VARIANTE_CURBA[0][2];
    }
    function aplicaOrizont() {
      var pr = profilCurba();
      scena.style.perspectiveOrigin = pr.ox + " " + pr.oy;
      scena.style.setProperty("--adancf", String(pr.adancf));
    }
    function scrieCurba(c, rot) {
      var v = rot.toFixed(2);
      if (c.curbaScrisa === v) return;
      c.curbaScrisa = v;
      c.el.style.setProperty("--crot", v + "deg");
    }
    /* rasucirea din v3: cardurile se apleaca usor dupa directia fugii,
       proportional cu departarea de card-ul deschis — restul variantelor
       stau perfect drepte, perspectiva face singura arcele */
    function aplicaCurba() {
      // estompeaza() ruleaza si inainte ca blocul experimentului sa se fi
      // initializat (var-urile sunt hoistate, dar goale) — atunci nu e nimic
      // de aplicat inca
      if (!VARIANTE_CURBA) return;
      var pr = profilCurba();
      if (!pr.rot) {
        for (var i = 0; i < carduri.length; i++) scrieCurba(carduri[i], 0);
        return;
      }
      var vw = scena.clientWidth;
      var st = scena.scrollLeft;
      for (var j = 0; j < carduri.length; j++) {
        var c = carduri[j];
        if (c.el.classList.contains("deschis")) { scrieCurba(c, 0); continue; }
        var L = pozitii[j] + (c.imp === "1" ? impMax : 0);
        var t = (L + latimi[j] / 2 - st) / vw - 0.5;
        scrieCurba(c, Math.max(-pr.rot, Math.min(pr.rot, t * pr.rot * 2)));
      }
    }
    if (gazdaVariante) {
      VARIANTE_CURBA.forEach(function (v) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = v[1];
        b.dataset.curba = v[0];
        b.classList.toggle("activ", v[0] === curba);
        b.addEventListener("click", function () {
          curba = v[0];
          try { localStorage.setItem("lot_curba", curba); } catch (e) {}
          Array.prototype.forEach.call(gazdaVariante.children, function (x) {
            x.classList.toggle("activ", x === b);
          });
          aplicaOrizont();
          estompeaza();
        });
        gazdaVariante.appendChild(b);
      });
      aplicaOrizont();
      estompeaza(); // aplica varianta salvata inca de la incarcare
    }

    // Evantaiul se construieste dupa ce soseste echipe.json, deci mult dupa
    // ce alte scripturi (stele.js, fantomele din main.js) si-au masurat
    // cursele de scroll. Fara recalculare, reperele lor raman inghetate la
    // inaltimea veche a paginii si parallax-ul sta pe loc.
    if (window.ScrollTrigger) ScrollTrigger.refresh();

    function alege(juc, cardEl, anima) {
      var idxNou = 0;
      carduri.forEach(function (c, i) { if (c.el === cardEl) idxNou = i; });

      /* Ținta camerei se calculează O DATĂ, înainte de schimbarea claselor:
         poziția actuală a cardului, corectată cu alunecarea pe care o va
         suferi când cardul deschis dinainte (dacă e în stânga lui) se pliază.
         O singură țintă fixă = o singură direcție de mișcare, fără dus-întors. */
      var tinta = null;
      if (anima) {
        // amprentele de layout sunt constante, deci offsetLeft nu se schimbă
        // la deschidere — ținta e directă
        tinta = pozitii[idxNou] - ANCORA;
        tinta = Math.max(0, Math.min(tinta, scena.scrollWidth - scena.clientWidth));
      }
      idxDeschis = idxNou;

      carduri.forEach(function (c) {
        var este = c.el === cardEl;
        c.el.classList.toggle("deschis", este);
        if (!este && c.el.classList.contains("extins")) {
          c.el.classList.remove("extins");
          var b = c.el.querySelector(".g-mai");
          b.setAttribute("aria-expanded", "false");
          b.innerHTML = "Detalii <b>+</b>";
        }
      });
      aplicaAdancimi(idxNou);

      // pe teren: postul jucătorului se aprinde, restul rămân gri
      var activ = null;
      puncte.forEach(function (p) {
        var este = p.getAttribute("data-post") === juc.post;
        p.classList.toggle("activ", este);
        if (este) activ = p;
      });
      if (activ) {
        var t = activ.getAttribute("transform");
        if (areGsap && anima) {
          gsap.to(marcaj, { attr: { transform: t }, duration: 0.7, ease: "power3.inOut" });
          gsap.fromTo(marcaj.querySelector(".lot-halo"), { attr: { r: 8 }, opacity: 0.9 },
            { attr: { r: 20 }, opacity: 0, duration: 0.9, ease: "power2.out", delay: 0.55 });
        } else {
          marcaj.setAttribute("transform", t);
        }
      }

      // „camera" se mută spre cardul ales chiar în timp ce acesta se lățește:
      // urmărire exponențială, recalculată cadru cu cadru. Pe telefon cardul
      // se lipește de marginea stângă, ca următoarele să rămână la vedere.
      // camera alunecă lin spre ținta fixă, în paralel cu lățirea cardului
      if (anima && tinta != null) {
        blocatDeCamera = true;
        if (areGsap) {
          gsap.killTweensOf(scena);
          gsap.to(scena, {
            scrollLeft: tinta, duration: 0.7, ease: "power3.out",
            onComplete: function () { blocatDeCamera = false; },
            onInterrupt: function () { blocatDeCamera = false; }
          });
        } else {
          scena.scrollTo({ left: tinta, behavior: "smooth" });
          setTimeout(function () { blocatDeCamera = false; }, 700);
        }
      }
    }

    // pulsul continuu al punctului activ
    if (areGsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(marcaj.querySelector(".lot-halo"), { attr: { r: 9 }, opacity: 0.7 },
        { attr: { r: 18 }, opacity: 0, duration: 1.6, ease: "power1.out", repeat: -1, repeatDelay: 0.4 });
    }
    alege(carduri[0].juc, carduri[0].el, false);
  }
})();
