/* Inscrieri Fotbal Juniori — grupele de varsta si formularul in 3 pasi.
   MOCKUP: trimiterea nu pleaca nicaieri, doar arata confirmarea; punctul
   de integrare reala e functia trimite() de mai jos. */
(function () {
  "use strict";

  // grupele sezonului 2026/2027 — anul nasterii da grupa
  var GRUPE = [
    { id: "U11", gen: "masculin", an: 2015 },
    { id: "U12", gen: "masculin", an: 2014 },
    { id: "U13", gen: "masculin", an: 2013 },
    { id: "U14", gen: "masculin", an: 2012 },
    { id: "U15", gen: "masculin", an: 2011 },
    { id: "U16", gen: "masculin", an: 2010 },
    { id: "U17", gen: "masculin", an: 2009 },
    { id: "U18", gen: "masculin", an: 2008 },
    { id: "U14F", gen: "feminin", an: 2012 },
    { id: "U15F", gen: "feminin", an: 2011 }
  ];

  var gazdaGrupe = document.getElementById("jr-grupe");
  var form = document.getElementById("jr-form");
  if (!gazdaGrupe || !form) return;

  var select = document.getElementById("jr-grupa");
  var pasi = document.getElementById("jr-pasi");
  var butonInainte = document.getElementById("jr-continua");
  var butonInapoi = document.getElementById("jr-inapoi");
  var confirmare = document.getElementById("jr-confirmare");
  var butoane = document.getElementById("jr-butoane");
  var pas = 1;

  function etichetaGrupa(g) {
    var nascuti = g.gen === "feminin" ? "născute" : "născuți";
    return g.id.replace("F", "") + (g.gen === "feminin" ? " Fete" : "") +
      " · " + nascuti + " " + g.an;
  }

  // cardurile de grupe (stanga) + optiunile selectului tin de aceeasi lista
  GRUPE.forEach(function (g) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "jr-grupa" + (g.gen === "feminin" ? " fete" : "");
    b.innerHTML = "<b>" + g.id.replace("F", "") + "</b>" +
      "<small>" + (g.gen === "feminin" ? "născute " : "născuți ") + g.an + "</small>" +
      '<span class="gen">' + g.gen + "</span>";
    b.addEventListener("click", function () {
      select.value = g.id;
      marcheazaAleasa();
      document.getElementById("jr-nume").focus();
    });
    b.dataset.grupa = g.id;
    gazdaGrupe.appendChild(b);

    var o = document.createElement("option");
    o.value = g.id;
    o.textContent = etichetaGrupa(g);
    select.appendChild(o);
  });
  select.addEventListener("change", marcheazaAleasa);

  function marcheazaAleasa() {
    Array.prototype.forEach.call(gazdaGrupe.children, function (el) {
      el.classList.toggle("aleasa", el.dataset.grupa === select.value);
    });
  }

  function deseneazaPasi() {
    var h = "";
    for (var i = 1; i <= 3; i++) {
      if (i > 1) h += '<span class="jr-pas-linie"></span>';
      var cls = i < pas ? "gata" : (i === pas ? "activ" : "");
      h += '<span class="jr-pas-punct ' + cls + '">' + (i < pas ? "✓" : i) + "</span>";
    }
    h += '<span style="margin-left:6px">Pasul ' + pas + " din 3</span>";
    pasi.innerHTML = h;
  }

  function arataPas() {
    Array.prototype.forEach.call(form.querySelectorAll("fieldset"), function (f) {
      f.hidden = Number(f.dataset.pas) !== pas;
    });
    butonInapoi.hidden = pas === 1;
    butonInainte.innerHTML = pas === 3 ? "Trimite cererea" : 'Continuă <span class="arrow">→</span>';
    deseneazaPasi();
  }

  function pasValid() {
    var activ = form.querySelector('fieldset[data-pas="' + pas + '"]');
    var campuri = activ.querySelectorAll("input, select, textarea");
    for (var i = 0; i < campuri.length; i++) {
      if (!campuri[i].checkValidity()) { campuri[i].reportValidity(); return false; }
    }
    return true;
  }

  function scrieRecap() {
    var g = GRUPE.filter(function (x) { return x.id === select.value; })[0];
    var rânduri = [
      ["Grupa", g ? etichetaGrupa(g) : "—"],
      ["Copil", document.getElementById("jr-nume").value],
      ["Data nașterii", document.getElementById("jr-data").value],
      ["Părinte", document.getElementById("jr-parinte").value],
      ["Telefon", document.getElementById("jr-telefon").value]
    ];
    var em = document.getElementById("jr-email").value;
    if (em) rânduri.push(["E-mail", em]);
    document.getElementById("jr-recap").innerHTML = rânduri.map(function (r) {
      return "<dt>" + r[0] + "</dt><dd>" + r[1].replace(/</g, "&lt;") + "</dd>";
    }).join("");
  }

  // punctul de integrare reala: aici se va face POST-ul cand exista backend
  function trimite() {
    Array.prototype.forEach.call(form.querySelectorAll("fieldset"), function (f) { f.hidden = true; });
    pasi.hidden = true;
    butoane.hidden = true;
    confirmare.hidden = false;
    confirmare.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!pasValid()) return;
    if (pas < 3) {
      pas++;
      if (pas === 3) scrieRecap();
      arataPas();
    } else {
      trimite();
    }
  });
  butonInapoi.addEventListener("click", function () {
    if (pas > 1) { pas--; arataPas(); }
  });

  arataPas();
})();
