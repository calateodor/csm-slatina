/* Informații de interes public — cardurile cu documente și situațiile
   financiare vin din data/documente.json, ca să poată fi schimbate din
   panoul de administrare (tabul Documente) fără să se umble în HTML.
   Marcajul static din pagină rămâne ca rezervă: dacă fișierul nu se poate
   citi, pagina arată exact ce era înainte. */
(function () {
  "use strict";

  var grila = document.getElementById("ip-carduri");
  var fin = document.getElementById("fin-grupuri");
  if (!grila || !fin || typeof fetch === "undefined") return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function card(c) {
    var h = '<article class="ip-card" id="' + esc(c.id) + '">' +
      '<div class="ip-cap"><h2>' + esc(c.titlu) + "</h2>" +
      (c.eticheta ? '<span class="ip-lege">' + esc(c.eticheta) + "</span>" : "") + "</div>" +
      (c.descriere ? '<p class="ip-desc">' + esc(c.descriere) + "</p>" : "");
    if (c.persoana) {
      h += '<dl class="ip-date"><div><dt>Persoana desemnată</dt><dd>' + esc(c.persoana) + "</dd></div>" +
        (c.email ? '<div><dt>Mijloc de raportare</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></dd></div>" : "") +
        "</dl>";
    } else if (c.link) {
      h += '<div class="ip-actiuni"><a class="btn btn-blue" href="' + esc(c.link) + '" target="_blank" rel="noopener">Mergi la platformă <span class="arrow">→</span></a></div>';
    } else if (c.fisier) {
      h += '<div class="ip-actiuni">' +
        '<a class="btn btn-blue" href="' + esc(c.fisier) + '" target="_blank" rel="noopener">Deschide documentul <span class="arrow">→</span></a>' +
        '<a class="ip-desc-link" href="' + esc(c.fisier) + '" download>Descarcă</a></div>';
    }
    return h + "</article>";
  }

  function rand(r) {
    var fisiere = r.fisiere || [];
    var unSingur = fisiere.length === 1;
    return '<li class="fin-rand">' +
      '<span class="fin-an">' + esc(r.an) + "</span>" +
      '<span class="fin-text"><b>' + esc(r.titlu) + "</b>" + (r.publicat ? "<i>publicat " + esc(r.publicat) + "</i>" : "") + "</span>" +
      '<span class="fin-fisiere">' + fisiere.map(function (f, i) {
        var pdf = /\.pdf$/i.test(f);
        return '<a href="' + esc(f) + '" target="_blank" rel="noopener" class="fin-fisier ' + (pdf ? "pdf" : "scan") + '">' +
          (unSingur ? "Documentul" : "Pagina " + (i + 1)) + "</a>";
      }).join("") + "</span></li>";
  }

  function grup(g) {
    return '<div class="fin-grup" id="' + esc(g.id) + '"><h3>' + esc(g.titlu) + "</h3>" +
      (g.descriere ? '<p class="fin-desc">' + esc(g.descriere) + "</p>" : "") +
      '<ol class="fin-lista">' + (g.randuri || []).map(rand).join("") + "</ol></div>";
  }

  fetch("data/documente.json?v=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (d.carduri && d.carduri.length) grila.innerHTML = d.carduri.map(card).join("");
      if (d.financiare && d.financiare.length) fin.innerHTML = d.financiare.map(grup).join("");
      // linkurile din meniu vin cu ancoră (#organigrama); după redesenare, ne așezăm pe ea
      if (location.hash) {
        var tinta = document.getElementById(location.hash.slice(1));
        if (tinta) tinta.scrollIntoView();
      }
    })
    .catch(function () { /* rămâne marcajul static */ });
})();
