/* Harta interactivă a bazei — pinuri plutitoare, editabile.
   + alege o activitate și o așezi cu click pe hartă (Esc iese)
   − intră în modul de ștergere: click pe pin îl scoate
   tras cu mouse-ul: muți un pin existent; totul se ține minte
   în localStorage (cheia "csm_harta_pins"). Export copiază JSON-ul. */
(function () {
  "use strict";

  // catalogul activităților: id, nume, iconiță, culoarea capsulei (+ text)
  var SERVICII = [
    { id: "fotbal",   nume: "Teren fotbal gazon",        ico: "⚽", fond: "#ffffff", text: "#0e1d40" },
    { id: "sintetic", nume: "Fotbal pe sintetic",        ico: "⚽", fond: "#c7f04c", text: "#1e2a08" },
    { id: "balon",    nume: "Teren acoperit (balon)",    ico: "🎪", fond: "#8f7bff", text: "#fff" },
    { id: "zgura",    nume: "Tenis zgură",               ico: "🎾", fond: "#ff6b57", text: "#fff" },
    { id: "hard",     nume: "Tenis hard",                ico: "🎾", fond: "#3aa0ff", text: "#fff" },
    { id: "padel",    nume: "Padel",                     ico: "🥎", fond: "#c7f04c", text: "#1e2a08" },
    { id: "volei",    nume: "Beach volley",              ico: "🏐", fond: "#f6c81c", text: "#0e1d40" },
    { id: "futnet",   nume: "Futnet (tenis cu piciorul)",ico: "🦶", fond: "#2ec4b6", text: "#fff" },
    { id: "minigolf", nume: "Minigolf",                  ico: "⛳", fond: "#ffffff", text: "#0e1d40" },
    { id: "piscina",  nume: "Piscină",                   ico: "🏊", fond: "#3aa0ff", text: "#fff" },
    { id: "plaja",    nume: "Plajă & șezlonguri",        ico: "🏖️", fond: "#f6c81c", text: "#0e1d40" },
    { id: "apa",      nume: "Pe apă — hidrobiciclete",   ico: "🛶", fond: "#2ec4b6", text: "#fff" },
    { id: "pontoane", nume: "Pontoane & evenimente",     ico: "🎉", fond: "#8f7bff", text: "#fff" },
    { id: "nautic",   nume: "Clubul Nautic",             ico: "⚓", fond: "#123a9e", text: "#fff" },
    { id: "frizerie", nume: "Frizerie",                  ico: "💈", fond: "#ff6b57", text: "#fff" },
    { id: "masaj",    nume: "Masaj",                     ico: "💆", fond: "#ffffff", text: "#0e1d40" },
    { id: "foisor",   nume: "Foișoare & căsuțe",         ico: "🏡", fond: "#ffffff", text: "#0e1d40" },
    { id: "parcare",  nume: "Parcare",                   ico: "🅿️", fond: "#123a9e", text: "#fff" }
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

  /* ---------- desen ---------- */
  function deseneaza() {
    Array.prototype.forEach.call(scena.querySelectorAll(".hpin"), function (el) { el.remove(); });
    pini.forEach(function (pin, idx) {
      var sv = serviciu(pin.s);
      var el = document.createElement("div");
      el.className = "hpin";
      el.style.left = pin.x + "%";
      el.style.top = pin.y + "%";
      el.style.setProperty("--hpin-fond", sv.fond);
      el.style.setProperty("--hpin-text", sv.text);
      el.dataset.idx = String(idx);
      el.innerHTML =
        '<span class="hpin-umbra"></span>' +
        '<span class="hpin-corp">' +
          '<span class="hpin-nume">' + sv.nume + "</span>" +
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
    b.innerHTML = '<span class="buline" style="--hpin-fond:' + sv.fond + '">' + sv.ico + "</span>" + sv.nume;
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
    // mod normal: apăsarea pe pin arată/ascunde numele
    if (elPin && !aTras) {
      var avea = elPin.classList.contains("cu-nume");
      Array.prototype.forEach.call(scena.querySelectorAll(".hpin.cu-nume"), function (el) {
        el.classList.remove("cu-nume");
      });
      if (!avea) elPin.classList.add("cu-nume");
    }
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

  deseneaza();
})();
