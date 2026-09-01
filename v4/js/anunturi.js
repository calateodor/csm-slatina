/* =========================================================
   Anunțuri și comunicate oficiale — arhiva din data/anunturi.json.
   ---------------------------------------------------------
   271 de intrări, grupate pe ani. Două lucruri contează aici:

   1. Să se găsească repede — cipuri de an și o căutare după
      titlu, aplicate amândouă local, fără reîncărcare.
   2. Pagina să rămână ușoară. Scanurile sunt fotografii mari
      ale actelor; dacă le-am pune pe toate în pagină, chiar și
      cu `loading="lazy"`, browserul ar avea de gestionat sute
      de imagini. De aceea marcajul unei intrări se construiește
      abia la prima deschidere, iar imaginile primesc `loading`
      și `decoding` leneșe.
   ========================================================= */
(function () {
  "use strict";

  var gazda = document.getElementById("anunturi-app");
  if (!gazda || typeof fetch === "undefined") return;

  var LUNI = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.",
              "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function dataScurta(iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + " " + LUNI[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  /* diacriticele nu trebuie să încurce căutarea: cine scrie „raport" trebuie
     să găsească și „Raport", și „RAPORT", indiferent de ș/ț din titlu */
  function normal(s) {
    s = String(s || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {}
    return s.replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/ă|â/g, "a").replace(/î/g, "i");
  }

  var toate = [];
  var anAles = "toate";
  var cautare = "";

  function filtrate() {
    var q = normal(cautare).trim();
    return toate.filter(function (a) {
      if (anAles !== "toate" && a.an !== anAles) return false;
      if (q && normal(a.titlu).indexOf(q) < 0 && normal(a.text || "").indexOf(q) < 0) return false;
      return true;
    });
  }

  function randItem(a) {
    var nr = (a.fisiere || []).length;
    var eticheta = nr === 0 ? "fără document"
                 : (nr === 1 ? "1 pagină" : nr + " pagini");
    return '<li class="an-item" data-slug="' + esc(a.slug) + '">' +
      '<button type="button" class="an-cap" aria-expanded="false">' +
        '<span class="an-data">' + esc(dataScurta(a.data)) + "</span>" +
        '<span class="an-titlu">' + esc(a.titlu) + "</span>" +
        '<span class="an-nr-pag">' + eticheta + "</span>" +
        '<span class="an-sageata" aria-hidden="true">›</span>' +
      "</button>" +
      '<div class="an-corp"><div><div class="an-continut"></div></div></div>' +
      "</li>";
  }

  /* Conținutul unei intrări se construiește la prima deschidere — vezi nota
     de sus: altfel am avea sute de <img> în pagină de la bun început. */
  function umple(item, a) {
    var gazdaC = item.querySelector(".an-continut");
    if (gazdaC.dataset.gata === "1") return;
    var h = "";
    if (a.text) h += '<p class="an-text">' + esc(a.text) + "</p>";
    var fis = a.fisiere || [];
    if (!fis.length && !a.text) {
      h += '<p class="an-gol">Anunțul a fost publicat fără document atașat.</p>';
    }
    if (fis.length) {
      h += '<div class="an-scanuri">';
      fis.forEach(function (f, i) {
        if (/\.pdf$/i.test(f)) {
          h += '<a class="an-desc-fisier" href="' + esc(f) + '" target="_blank" rel="noopener">' +
               "PDF · deschide documentul</a>";
        } else {
          h += '<a href="' + esc(f) + '" target="_blank" rel="noopener">' +
               '<img src="' + esc(f) + '" alt="' + esc(a.titlu) + " — pagina " + (i + 1) +
               '" loading="lazy" decoding="async"></a>';
        }
      });
      h += "</div>";
    }
    gazdaC.innerHTML = h;
    gazdaC.dataset.gata = "1";
  }

  function deseneaza() {
    var lista = filtrate();
    var numar = document.getElementById("an-numar");
    numar.innerHTML = "<b>" + lista.length + "</b> " +
      (lista.length === 1 ? "anunț" : "anunțuri") +
      (anAles === "toate" ? " în arhivă" : " în " + anAles);

    var gazdaL = document.getElementById("an-lista");
    if (!lista.length) {
      gazdaL.innerHTML = '<p class="an-nimic">Niciun anunț nu se potrivește căutării.</p>';
      return;
    }
    // grupate pe ani, cel mai recent întâi
    var grupe = [];
    var curent = null;
    lista.forEach(function (a) {
      if (!curent || curent.an !== a.an) { curent = { an: a.an, items: [] }; grupe.push(curent); }
      curent.items.push(a);
    });
    gazdaL.innerHTML = grupe.map(function (g) {
      return '<section class="an-grup"><h3>' + esc(g.an) + "</h3>" +
        '<ul class="an-lista">' + g.items.map(randItem).join("") + "</ul></section>";
    }).join("");
  }

  gazda.addEventListener("click", function (ev) {
    var buton = ev.target.closest(".an-cap");
    if (!buton) return;
    var item = buton.closest(".an-item");
    var a = toate.filter(function (x) { return x.slug === item.dataset.slug; })[0];
    if (a) umple(item, a);
    var deschis = item.classList.toggle("deschis");
    buton.setAttribute("aria-expanded", deschis ? "true" : "false");
  });

  fetch("data/anunturi.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) {
      toate = (d.anunturi || []).slice().sort(function (a, b) {
        return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0);
      });

      var ani = [];
      toate.forEach(function (a) { if (ani.indexOf(a.an) < 0) ani.push(a.an); });
      var gazdaAni = document.getElementById("an-ani");
      gazdaAni.innerHTML = '<button type="button" class="an-an-cip activ" data-an="toate">Toate</button>' +
        ani.map(function (an) {
          return '<button type="button" class="an-an-cip" data-an="' + esc(an) + '">' + esc(an) + "</button>";
        }).join("");
      gazdaAni.addEventListener("click", function (ev) {
        var cip = ev.target.closest(".an-an-cip");
        if (!cip) return;
        gazdaAni.querySelectorAll(".an-an-cip").forEach(function (x) { x.classList.remove("activ"); });
        cip.classList.add("activ");
        anAles = cip.dataset.an;
        deseneaza();
      });

      var camp = document.getElementById("an-cauta");
      var asteapta = null;
      camp.addEventListener("input", function () {
        clearTimeout(asteapta);
        asteapta = setTimeout(function () { cautare = camp.value; deseneaza(); }, 150);
      });

      deseneaza();
    })
    .catch(function () {
      document.getElementById("an-lista").innerHTML =
        '<p class="an-nimic">Arhiva nu a putut fi încărcată.</p>';
    });
})();
