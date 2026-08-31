/* Harta interactivă a bazei — pinuri plutitoare, editabile.
   + alege o activitate și o așezi cu click pe hartă (Esc iese)
   − intră în modul de ștergere: click pe pin îl scoate
   tras cu mouse-ul: muți un pin existent; totul se ține minte
   în localStorage (cheia "csm_harta_pins"). Export copiază JSON-ul. */
(function () {
  "use strict";

  // catalogul activităților: id, nume, iconiță, culoarea capsulei (+ text),
  // tarif + poza — apar în eticheta pinului la apăsare (goale = doar numele)
  var POZE = "assets/img/harta/";
  var SERVICII = [
    { id: "fotbal",   nume: "Teren fotbal gazon",        ico: "⚽", fond: "#ffffff", text: "#0e1d40", tarif: "", poza: POZE + "thumb-fotbal.webp" },
    { id: "sintetic", nume: "Fotbal pe sintetic",        ico: "⚽", fond: "#c7f04c", text: "#1e2a08", tarif: "110 lei/oră ziua · 130 lei/oră nocturn", poza: POZE + "thumb-sintetic.webp" },
    { id: "balon",    nume: "Teren acoperit (balon)",    ico: "🎪", fond: "#8f7bff", text: "#fff",    tarif: "", poza: "" },
    { id: "zgura",    nume: "Tenis zgură",               ico: "🎾", fond: "#ff6b57", text: "#fff",    tarif: "40 lei/oră ziua · 45 lei/oră nocturn", poza: POZE + "thumb-zgura.webp" },
    { id: "hard",     nume: "Tenis hard",                ico: "🎾", fond: "#3aa0ff", text: "#fff",    tarif: "rezervări: 0349 883 938", poza: POZE + "thumb-hard.webp" },
    { id: "padel",    nume: "Padel",                     ico: "🥎", fond: "#c7f04c", text: "#1e2a08", tarif: "40 lei/oră (10–16) · 60 lei/oră (16–24)", poza: POZE + "thumb-padel.webp" },
    { id: "volei",    nume: "Beach volley",              ico: "🏐", fond: "#f6c81c", text: "#0e1d40", tarif: "25 lei/oră · 13 lei/30 min", poza: POZE + "thumb-volei.webp" },
    { id: "futnet",   nume: "Tenis de picior",ico: "🦶", fond: "#2ec4b6", text: "#fff",    tarif: "80 lei/oră · minge inclusă", poza: POZE + "thumb-futnet.webp" },
    { id: "minigolf", nume: "Minigolf",                  ico: "⛳", fond: "#ffffff", text: "#0e1d40", tarif: "11 lei/oră/crosă · 7 lei/30 min", poza: POZE + "thumb-minigolf.webp" },
    { id: "piscina",  nume: "Piscină",                   ico: "🏊", fond: "#3aa0ff", text: "#fff",    tarif: "inclusă în accesul la plajă", poza: POZE + "thumb-piscina.webp" },
    { id: "plaja",    nume: "Plajă & șezlonguri",        ico: "🏖️", fond: "#f6c81c", text: "#0e1d40", tarif: "20 lei adulți · 10 lei copii sub 14 · șezlong 10 lei/zi", poza: POZE + "thumb-plaja.webp" },
    { id: "apa",      nume: "Pe apă — caiac & hidrobiciclete", ico: "🛶", fond: "#2ec4b6", text: "#fff", tarif: "caiac 30 lei/30 min · hidrobicicletă 20 lei/30 min", poza: POZE + "thumb-apa.webp" },
    { id: "pontoane", nume: "Pontoane & evenimente",     ico: "🎉", fond: "#8f7bff", text: "#fff",    tarif: "evenimente private: 0349 883 938", poza: POZE + "thumb-pontoane.webp" },
    { id: "nautic",   nume: "Clubul Nautic",             ico: "⚓", fond: "#123a9e", text: "#fff",    tarif: "", poza: "" },
    { id: "frizerie", nume: "Frizerie",                  ico: "💈", fond: "#ff6b57", text: "#fff",    tarif: "de la 40 lei · copii 30 lei", poza: POZE + "thumb-frizerie.webp" },
    { id: "masaj",    nume: "Masaj",                     ico: "💆", fond: "#ffffff", text: "#0e1d40", tarif: "50 lei / 30 min", poza: POZE + "thumb-masaj.webp" },
    { id: "foisor",   nume: "Foișoare & căsuțe",         ico: "🏡", fond: "#ffffff", text: "#0e1d40", tarif: "", poza: "" },
    { id: "parcare",  nume: "Parcare",                   ico: "🅿️", fond: "#123a9e", text: "#fff",    tarif: "gratuită · 300+ locuri", poza: "" }
  ];

  // așezarea oficială — pusă de Teo pe hartă (export din 29.08.2026)
  var PORNIRE = [
    { s: "zgura",    x: 29.77, y: 21.81 },
    { s: "hard",     x: 64.24, y: 23.88 },
    { s: "volei",    x: 69.59, y: 27.39 },
    { s: "minigolf", x: 85.12, y: 44.55 },
    { s: "nautic",   x: 56.22, y: 35.76 },
    { s: "piscina",  x: 31.51, y: 78.45 },
    { s: "plaja",    x: 37.97, y: 69.25 },
    { s: "parcare",  x: 10.7,  y: 26.25 },
    { s: "zgura",    x: 60.64, y: 29.56 },
    { s: "hard",     x: 67.15, y: 19.33 },
    { s: "padel",    x: 18.84, y: 16.33 },
    { s: "zgura",    x: 22.73, y: 18.71 },
    { s: "apa",      x: 12.38, y: 50.13 },
    { s: "futnet",   x: 72.85, y: 33.39 },
    { s: "fotbal",   x: 74.71, y: 21.71 }
  ];

  var CHEIE = "csm_harta_pins";
  var scena = document.getElementById("harta-scena");
  if (!scena) return;

  // pe pagina cu unelte (harta.html) se poate edita; incorporata
  // in alte pagini (club-nautic), harta e doar de privit
  var editabil = !!document.getElementById("ht-adauga");

  var pini = incarca();
  var modAdauga = null;   // serviciul ales pentru plasare
  var modSterge = false;

  function serviciu(id) {
    for (var i = 0; i < SERVICII.length; i++) if (SERVICII[i].id === id) return SERVICII[i];
    return SERVICII[0];
  }
  function incarca() {
    // doar editorul isi tine varianta proprie; vizitatorii vad asezarea oficiala
    if (editabil) {
      try {
        var brut = localStorage.getItem(CHEIE);
        if (brut) {
          var lista = JSON.parse(brut);
          if (Array.isArray(lista)) return lista;
        }
      } catch (e) {}
    }
    return PORNIRE.map(function (p) { return { s: p.s, x: p.x, y: p.y }; });
  }
  function salveaza() {
    try { localStorage.setItem(CHEIE, JSON.stringify(pini)); } catch (e) {}
  }

  /* prima parte a tarifului (până la „·”) e prețul principal: pe card se
     scrie mare și bold, restul rămâne dedesubt, mai mic */
  function tarifMarcat(t) {
    var i = t.indexOf("·");
    if (i < 0) return "<strong>" + t + "</strong>";
    return "<strong>" + t.slice(0, i).trim() + "</strong>" + t.slice(i + 1).trim();
  }

  /* ---------- desen ---------- */
  function deseneaza() {
    strangeCard();   // cardul liber ar rămâne orfan dacă pinul lui e redesenat
    Array.prototype.forEach.call(scena.querySelectorAll(".hpin"), function (el) { el.remove(); });
    pini.forEach(function (pin, idx) {
      var sv = serviciu(pin.s);
      var el = document.createElement("div");
      el.className = "hpin" +
        (pin.y < 38 ? " sus" : "") +          // cardul se deschide sub pin, nu peste marginea hartii
        (pin.x < 12 ? " stanga" : "") +       // aproape de margini, cardul se lipeste de ele
        (pin.x > 88 ? " dreapta" : "");
      el.style.left = pin.x + "%";
      el.style.top = pin.y + "%";
      el.style.setProperty("--hpin-fond", sv.fond);
      el.style.setProperty("--hpin-text", sv.text);
      el.dataset.idx = String(idx);
      el.innerHTML =
        '<span class="hpin-umbra"></span>' +
        '<span class="hpin-corp">' +
          '<span class="hpin-card">' +
            (sv.poza ? '<img src="' + sv.poza + '" alt="" loading="lazy">' : "") +
            "<b>" + sv.nume + "</b>" +
            (sv.tarif ? "<i>" + tarifMarcat(sv.tarif) + "</i>" : "") +
            (sv.poza ? '<em class="hpin-cta">Rezervă <span>→</span></em>' : "") +
          "</span>" +
          '<span class="hpin-cap">' + sv.ico + '<span class="hpin-x">×</span></span>' +
          '<span class="hpin-tija"></span>' +
        "</span>";
      scena.appendChild(el);
    });
  }

  /* ---------- unelte ---------- */
  var butonAdauga = document.getElementById("ht-adauga");
  var butonSterge = document.getElementById("ht-sterge");
  var panou = document.getElementById("ht-panou");
  var lista = document.getElementById("ht-lista");
  var indiciu = document.getElementById("ht-indiciu");

  if (editabil) {

  SERVICII.forEach(function (sv) {
    var b = document.createElement("button");
    b.className = "ht-serviciu";
    b.innerHTML = '<span class="buline" style="--hpin-fond:' + sv.fond + '">' + sv.ico + "</span>" +
      "<span>" + sv.nume + (sv.tarif ? "<small>" + sv.tarif + "</small>" : "") + "</span>";
    b.addEventListener("click", function () {
      modAdauga = sv.id;
      opresteStergerea();
      panou.hidden = true;
      butonAdauga.classList.add("activ");
      scena.classList.add("tinta");
      spune("Apasă pe hartă unde vrei pinul „" + sv.nume + "”. Poți pune mai multe la rând — Esc sau + ca să termini.");
    });
    lista.appendChild(b);
  });

  function spune(text) {
    indiciu.textContent = text;
    indiciu.hidden = !text;
  }
  function opresteAdaugarea() {
    modAdauga = null;
    butonAdauga.classList.remove("activ");
    scena.classList.remove("tinta");
    panou.hidden = true;
    spune("");
  }
  function opresteStergerea() {
    modSterge = false;
    butonSterge.classList.remove("activ");
    scena.classList.remove("mod-sterge");
  }

  butonAdauga.addEventListener("click", function () {
    if (modAdauga || !panou.hidden) { opresteAdaugarea(); return; }
    opresteStergerea();
    panou.hidden = false;
  });
  document.getElementById("ht-inchide").addEventListener("click", opresteAdaugarea);

  butonSterge.addEventListener("click", function () {
    opresteAdaugarea();
    modSterge = !modSterge;
    butonSterge.classList.toggle("activ", modSterge);
    scena.classList.toggle("mod-sterge", modSterge);
    spune(modSterge ? "Apasă pe pinul pe care vrei să-l ștergi. − sau Esc ca să ieși." : "");
  });

  document.getElementById("ht-export").addEventListener("click", function () {
    var json = JSON.stringify(pini);
    try { navigator.clipboard.writeText(json); } catch (e) {}
    console.log("harta pins:", json);
    spune("Așezarea a fost copiată în clipboard (" + pini.length + " pinuri).");
    setTimeout(function () { if (!modAdauga && !modSterge) spune(""); }, 3000);
  });

  document.getElementById("ht-reset").addEventListener("click", function () {
    if (!confirm("Revii la așezarea inițială? Pinurile puse de tine se pierd.")) return;
    pini = PORNIRE.map(function (p) { return { s: p.s, x: p.x, y: p.y }; });
    salveaza();
    deseneaza();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { opresteAdaugarea(); opresteStergerea(); }
  });

  } // sfarsitul uneltelor de editare

  /* ---------- cardul „liber" (ecrane tactile) ----------
     Pe telefon harta stă într-un derulator orizontal, iar derulatorul taie
     cardurile pinurilor de lângă margini. La deschidere, cardul pinului e
     mutat într-o ancoră cu position:fixed pe <body> — de acolo nu-l mai
     poate tăia nicio margine — și e adus înapoi în pin la închidere. */
  var ancora = null, cardLiber = null, pinLiber = null;

  function faraHoverAcum() { return window.matchMedia("(hover: none)").matches; }

  function elibereazaCard(elPin) {
    if (!faraHoverAcum()) return;
    strangeCard();
    var corp = elPin.querySelector(".hpin-corp");
    var card = corp && corp.querySelector(".hpin-card");
    if (!card) return;
    if (!ancora) {
      ancora = document.createElement("span");
      ancora.className = "hcard-ancora";
      document.body.appendChild(ancora);
    }
    // culorile pinului trăiesc pe .hpin: cardul le ia cu el în ancoră
    card.style.setProperty("--hpin-fond", elPin.style.getPropertyValue("--hpin-fond"));
    card.style.setProperty("--hpin-text", elPin.style.getPropertyValue("--hpin-text"));
    ancora.classList.remove("aratata", "jos");
    ancora.appendChild(card);
    cardLiber = card;
    pinLiber = elPin;
    aseazaAncora();
    requestAnimationFrame(function () {
      if (cardLiber) ancora.classList.add("aratata");
    });
  }

  function aseazaAncora() {
    if (!cardLiber || !pinLiber) return;
    var cap = pinLiber.querySelector(".hpin-cap");
    if (!cap) { strangeCard(); return; }
    var rc = cap.getBoundingClientRect();
    // pinul a ieșit din ecran odată cu derularea: cardul se închide singur
    if (rc.bottom < 0 || rc.top > window.innerHeight || rc.right < 0 || rc.left > window.innerWidth) {
      if (pinLiber) pinLiber.classList.remove("extins");
      strangeCard();
      return;
    }
    /* offsetWidth/Height, NU getBoundingClientRect: cardul intră animat, de
       la scale(0.12), iar rect-ul ar da dimensiunea micșorată (24×26 în loc
       de 196×217). Din măsurătoarea aia greșită ieșea o poziție greșită, pe
       care o corectam un cadru mai târziu — cardul sărea și părea că se
       deschide a doua oară. offset* dă dimensiunea reală, netransformată. */
    var lat = cardLiber.offsetWidth || 212;
    var inalt = cardLiber.offsetHeight || 180;
    // centrat pe pin, dar niciodată afară din ecran
    var x = rc.left + rc.width / 2;
    x = Math.min(Math.max(x, lat / 2 + 8), window.innerWidth - lat / 2 - 8);
    // deasupra pinului; dacă nu are loc până sus, se deschide dedesubt
    var jos = rc.top - inalt - 16 < 8;
    ancora.classList.toggle("jos", jos);
    ancora.style.left = x + "px";
    ancora.style.top = (jos ? rc.bottom : rc.top) + "px";
  }

  function strangeCard() {
    if (cardLiber && pinLiber) {
      var corp = pinLiber.querySelector(".hpin-corp");
      if (corp) corp.insertBefore(cardLiber, corp.querySelector(".hpin-cap"));
    }
    if (ancora) ancora.classList.remove("aratata", "jos");
    cardLiber = null;
    pinLiber = null;
  }

  function inchidePin(el) {
    el.classList.remove("extins");
    if (el === pinLiber) strangeCard();
  }

  /* Derularea închide cardul. Excepție: derulatorul orizontal al hărții —
     acolo omul mută harta, nu pleacă de la ea, deci cardul rămâne lipit
     de pin. (capture: derulatorul nu-și ridică evenimentul de scroll.) */
  window.addEventListener("scroll", function (ev) {
    if (!cardLiber) return;
    // orice derulare închide cardul, MAI PUȚIN cea a hărții însăși
    var peHarta = ev.target && ev.target.closest &&
      ev.target.closest(".harta-embed, .harta-cadru");
    if (!peHarta) {
      if (pinLiber) pinLiber.classList.remove("extins");
      strangeCard();
    } else {
      aseazaAncora();
    }
  }, { capture: true, passive: true });
  window.addEventListener("resize", function () { if (cardLiber) aseazaAncora(); });

  /* Pe card navighează DOAR butonul „Rezervă” — restul cardului se poate
     citi în liniște, fără ca pagina să sară în jos din greșeală. */
  document.addEventListener("click", function (ev) {
    if (!cardLiber || !ancora || !ancora.contains(ev.target)) return;
    if (!ev.target.closest(".hpin-cta")) return;
    var ales = pini[Number(pinLiber.dataset.idx)];
    // închidem întâi: plecăm de la hartă, cardul n-are ce căuta peste panou
    if (pinLiber) pinLiber.classList.remove("extins");
    strangeCard();
    if (ales) document.dispatchEvent(new CustomEvent("harta:activitate", { detail: ales.s }));
  });

  /* ---------- interacțiunea cu scena ---------- */
  function procente(ev) {
    var r = scena.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100))
    };
  }

  scena.addEventListener("click", function (ev) {
    // tinta e cea de la apasare: capul pinului salta din animatie si
    // click-ul ar rata-o altfel
    var elPin = ultimPin || ev.target.closest(".hpin");

    if (modSterge && elPin) {
      pini.splice(Number(elPin.dataset.idx), 1);
      salveaza();
      deseneaza();
      return;
    }
    if (modAdauga && !elPin) {
      var p = procente(ev);
      pini.push({ s: modAdauga, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
      salveaza();
      deseneaza();
      return;
    }
    // mod normal: pe desktop hover-ul arata cardul, iar click-ul pe pin duce
    // la panoul activitatii; pe ecrane tactile pinul e comutator (o atingere
    // deschide cardul, inca una il inchide), iar spre panou duce butonul
    // „Rezerva” de pe card
    if (elPin && !aTras) {
      var faraHover = faraHoverAcum();
      var eraExtins = elPin.classList.contains("extins");
      Array.prototype.forEach.call(scena.querySelectorAll(".hpin.extins"), inchidePin);
      if (faraHover) {
        // pe ecrane tactile pinul se comportă ca un comutator: o atingere
        // deschide cardul, încă una îl închide. Spre panou duce doar
        // butonul „Rezervă” de pe card.
        if (!eraExtins) {
          elPin.classList.add("extins");
          elibereazaCard(elPin);
        }
        return;
      }
      var pinAles = pini[Number(elPin.dataset.idx)];
      if (pinAles) {
        document.dispatchEvent(new CustomEvent("harta:activitate", { detail: pinAles.s }));
      }
    }
    if (!elPin) {
      Array.prototype.forEach.call(scena.querySelectorAll(".hpin.extins"), inchidePin);
    }
  });

  /* hover-ul pe un pin inchide orice alt card ramas deschis (ex. dupa
     „Vezi pe harta” sau dupa un click care a derulat pagina) */
  scena.addEventListener("pointerover", function (ev) {
    var peste = ev.target.closest(".hpin");
    if (!peste) return;
    Array.prototype.forEach.call(scena.querySelectorAll(".hpin.extins"), function (el) {
      if (el !== peste) inchidePin(el);
    });
  });

  /* tras cu mouse-ul (mod normal) */
  var pinTras = null;
  var aTras = false;
  var ultimPin = null;   // pinul pe care a inceput apasarea, oricare ar fi modul
  scena.addEventListener("pointerdown", function (ev) {
    ultimPin = ev.target.closest(".hpin");
    if (!editabil || modAdauga || modSterge) return;   // tras doar in editor
    if (!ultimPin) return;
    pinTras = ultimPin;
    aTras = false;
    scena.setPointerCapture && scena.setPointerCapture(ev.pointerId);
  });
  scena.addEventListener("pointermove", function (ev) {
    if (!pinTras) return;
    aTras = true;
    pinTras.classList.add("tras");
    var p = procente(ev);
    pinTras.style.left = p.x + "%";
    pinTras.style.top = p.y + "%";
  });
  scena.addEventListener("pointerup", function (ev) {
    if (!pinTras) return;
    if (aTras) {
      var p = procente(ev);
      var pin = pini[Number(pinTras.dataset.idx)];
      pin.x = Math.round(p.x * 100) / 100;
      pin.y = Math.round(p.y * 100) / 100;
      salveaza();
    }
    pinTras.classList.remove("tras");
    pinTras = null;
    setTimeout(function () { aTras = false; }, 0);
  });

  /* „Vezi pe hartă” de pe carduri: centrăm harta pe pin și îl facem să pulseze */
  document.addEventListener("harta:arata", function (ev) {
    var ids = String(ev.detail || "").split(" ");
    var idx = -1;
    for (var i = 0; i < pini.length; i++) {
      if (ids.indexOf(pini[i].s) !== -1) { idx = i; break; }
    }
    if (idx < 0) return;
    var el = scena.querySelector('.hpin[data-idx="' + idx + '"]');
    if (!el) return;
    var cadru = scena.parentElement;
    if (cadru && cadru.scrollWidth > cadru.clientWidth + 4) {
      cadru.scrollTo({
        left: Math.max(0, scena.clientWidth * pini[idx].x / 100 - cadru.clientWidth / 2),
        behavior: "smooth"
      });
    }
    Array.prototype.forEach.call(scena.querySelectorAll(".hpin.extins"), function (e2) {
      e2.classList.remove("extins");
    });
    el.classList.add("extins");
    el.classList.add("pulsat");
    setTimeout(function () { el.classList.remove("pulsat"); }, 2700);
  });

  deseneaza();

  /* tarifele „vii”: data/tarife.json (editabil din panou) bate valorile
     scrise in catalogul de mai sus; daca fisierul lipseste, ramanem pe ele */
  var laDate = (document.currentScript && document.currentScript.src)
    ? new URL("data/tarife.json", document.currentScript.src.replace(/js\/[^\/]*$/, ""))
    : "data/tarife.json";
  try {
    fetch(laDate, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (t) {
        if (!t) return;
        var schimbat = false;
        SERVICII.forEach(function (sv) {
          if (t[sv.id] && typeof t[sv.id].tarif === "string" && t[sv.id].tarif !== sv.tarif) {
            sv.tarif = t[sv.id].tarif;
            schimbat = true;
          }
        });
        if (schimbat) deseneaza();
      })
      .catch(function () {});
  } catch (e) {}
})();
