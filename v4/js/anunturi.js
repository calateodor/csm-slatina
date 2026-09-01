/* =========================================================
   Anunțuri și comunicate oficiale — arhiva din data/anunturi.json.
   ---------------------------------------------------------
   271 de intrări, grupate pe ani. Două lucruri contează aici:

   1. Să se găsească repede — cipuri de an și o căutare după
      titlu, aplicate amândouă local, fără reîncărcare.
   2. Starea listei (an, căutare, pagină) să stea în adresă,
      ca pagina 2 să fie un link care poate fi trimis și ca
      butonul „înapoi" să parcurgă paginile, nu să iasă din ele.
   3. Pagina să rămână ușoară. Scanurile sunt fotografii mari
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
  var pagina = 1;
  /* 25 pe pagină: vederea completă avea aproape 20.000 de pixeli, adică vreo
     43 de ecrane de derulat. Gruparea pe luni ar fi înrăutățit lucrurile —
     sunt 69 de luni pentru 271 de anunțuri, iar 38% dintre ele au doar unul
     sau două, deci ar fi ieșit un titlu la fiecare patru rânduri. */
  var PE_PAGINA = 25;

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

  /* Numerele de pagină: primele și ultimele, plus vecinii paginii curente.
     La 11 pagini încă ar încăpea toate, dar dacă arhiva mai crește lista de
     numere ar ajunge să se reverse pe două rânduri. */
  function numerePagini(total, curenta) {
    var n = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - curenta) <= 1) n.push(i);
      else if (n[n.length - 1] !== "…") n.push("…");
    }
    return n;
  }

  function randPaginare(total) {
    if (total <= 1) return "";
    var h = '<nav class="an-paginare" aria-label="Paginile arhivei">';
    h += '<button type="button" class="an-pag-sageata" data-pagina="' + (pagina - 1) +
         '"' + (pagina === 1 ? " disabled" : "") + ' aria-label="Pagina anterioară">‹</button>';
    numerePagini(total, pagina).forEach(function (x) {
      if (x === "…") { h += '<span class="an-pag-puncte">…</span>'; return; }
      h += '<button type="button" class="an-pag-nr' + (x === pagina ? " activ" : "") +
           '" data-pagina="' + x + '"' + (x === pagina ? ' aria-current="page"' : "") +
           ">" + x + "</button>";
    });
    h += '<button type="button" class="an-pag-sageata" data-pagina="' + (pagina + 1) +
         '"' + (pagina === total ? " disabled" : "") + ' aria-label="Pagina următoare">›</button>';
    return h + "</nav>";
  }

  function deseneaza() {
    var lista = filtrate();
    var totalPagini = Math.max(1, Math.ceil(lista.length / PE_PAGINA));
    if (pagina > totalPagini) pagina = totalPagini;

    var numar = document.getElementById("an-numar");
    numar.innerHTML = "<b>" + lista.length + "</b> " +
      (lista.length === 1 ? "anunț" : "anunțuri") +
      (anAles === "toate" ? " în arhivă" : " în " + anAles) +
      (totalPagini > 1 ? " · pagina " + pagina + " din " + totalPagini : "");

    var gazdaL = document.getElementById("an-lista");
    if (!lista.length) {
      gazdaL.innerHTML = '<p class="an-nimic">Niciun anunț nu se potrivește căutării.</p>';
      return;
    }
    var felie = lista.slice((pagina - 1) * PE_PAGINA, pagina * PE_PAGINA);

    // grupate pe ani, cel mai recent întâi; o pagină poate cuprinde doi ani
    var grupe = [];
    var curent = null;
    felie.forEach(function (a) {
      if (!curent || curent.an !== a.an) { curent = { an: a.an, items: [] }; grupe.push(curent); }
      curent.items.push(a);
    });
    gazdaL.innerHTML = grupe.map(function (g) {
      return '<section class="an-grup"><h3>' + esc(g.an) + "</h3>" +
        '<ul class="an-lista">' + g.items.map(randItem).join("") + "</ul></section>";
    }).join("") + randPaginare(totalPagini);
  }

  /* Starea listei stă în adresă: ?an=2025&p=2&q=raport
     Fără asta, pagina 2 nu e o adresă reală — cine primește linkul aterizează
     tot pe pagina 1, iar butonul „înapoi" al browserului iese din pagină în loc
     să se întoarcă la pagina anterioară. Pe site-ul vechi /page/2/ era link. */
  function scrieAdresa(impinge) {
    var p = new URLSearchParams();
    if (anAles !== "toate") p.set("an", anAles);
    if (cautare.trim()) p.set("q", cautare.trim());
    if (pagina > 1) p.set("p", pagina);
    var q = p.toString();
    var adresa = location.pathname + (q ? "?" + q : "") + location.hash;
    try {
      history[impinge ? "pushState" : "replaceState"](
        { an: anAles, q: cautare, p: pagina }, "", adresa);
    } catch (e) { /* fișier local sau istoric plin — nu e nimic critic */ }
  }

  function citesteAdresa() {
    var p = new URLSearchParams(location.search);
    anAles = p.get("an") || "toate";
    cautare = p.get("q") || "";
    pagina = Math.max(1, parseInt(p.get("p"), 10) || 1);
  }

  function laPagina(p, faraIstoric) {
    pagina = p;
    if (!faraIstoric) scrieAdresa(true);
    deseneaza();
    // ne întoarcem la începutul listei, altfel pagina nouă începe „la mijloc"
    var sus = document.querySelector(".an-unelte");
    if (sus) {
      var y = sus.getBoundingClientRect().top + window.pageYOffset -
              (parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue("--header-h")) || 84) - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  gazda.addEventListener("click", function (ev) {
    var pag = ev.target.closest("[data-pagina]");
    if (pag && !pag.disabled) { laPagina(parseInt(pag.dataset.pagina, 10)); return; }
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
      citesteAdresa();
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
        pagina = 1;   // altfel ai ramane pe o pagina care poate nu mai exista
        scrieAdresa(true);
        deseneaza();
      });

      var camp = document.getElementById("an-cauta");
      var asteapta = null;
      camp.addEventListener("input", function () {
        clearTimeout(asteapta);
        asteapta = setTimeout(function () {
          cautare = camp.value; pagina = 1;
          scrieAdresa(false);   // inlocuim, nu impingem: altfel fiecare litera ar fi un pas inapoi
          deseneaza();
        }, 150);
      });

      // punem uneltele pe valorile din adresa
      camp.value = cautare;
      gazdaAni.querySelectorAll(".an-an-cip").forEach(function (x) {
        x.classList.toggle("activ", x.dataset.an === anAles);
      });
      deseneaza();

      // butonul „inapoi" al browserului parcurge paginile, nu iese din pagina
      window.addEventListener("popstate", function () {
        citesteAdresa();
        camp.value = cautare;
        gazdaAni.querySelectorAll(".an-an-cip").forEach(function (x) {
          x.classList.toggle("activ", x.dataset.an === anAles);
        });
        deseneaza();
      });
    })
    .catch(function () {
      document.getElementById("an-lista").innerHTML =
        '<p class="an-nimic">Arhiva nu a putut fi încărcată.</p>';
    });
})();
