/* ==========================================================================
   Galerie cu lightbox — comună tuturor paginilor de secții
   Orice .sport-gallery devine clicabilă: poza se deschide mare, peste pagină,
   cu săgeți stânga/dreapta, X, Esc și swipe pe telefon.
   Dacă o galerie nu are nicio poză (ex. fotbal, până se aleg pozele),
   întreaga secțiune .gallery-block se ascunde singură.
   ========================================================================== */
(function () {
  "use strict";

  var galerii = document.querySelectorAll(".sport-gallery");
  if (!galerii.length) return;

  /* ---------- overlay-ul: unul singur, refolosit de toate galeriile ---------- */
  var strat = document.createElement("div");
  strat.className = "lb-strat";
  strat.setAttribute("role", "dialog");
  strat.setAttribute("aria-modal", "true");
  strat.setAttribute("aria-label", "Imagine mărită");
  strat.innerHTML =
    '<button class="lb-inchide" aria-label="Închide">&#10005;</button>' +
    '<button class="lb-sageata lb-inapoi" aria-label="Imaginea anterioară">&#8249;</button>' +
    '<figure class="lb-cadru"><img alt=""><figcaption></figcaption></figure>' +
    '<button class="lb-sageata lb-inainte" aria-label="Imaginea următoare">&#8250;</button>' +
    '<span class="lb-contor" aria-hidden="true"></span>';
  document.body.appendChild(strat);

  var lbImg = strat.querySelector("img");
  var lbLegenda = strat.querySelector("figcaption");
  var lbContor = strat.querySelector(".lb-contor");

  var poze = [];      // pozele galeriei deschise
  var idx = 0;
  var deschis = false;

  function arata(i) {
    idx = (i + poze.length) % poze.length;
    var im = poze[idx];
    lbImg.src = im.src;
    lbImg.alt = im.alt || "";
    lbLegenda.textContent = im.alt || "";
    lbContor.textContent = poze.length > 1 ? (idx + 1) + " / " + poze.length : "";
    // preîncarcă vecinii, ca săgețile să nu aștepte
    if (poze.length > 1) {
      [idx + 1, idx - 1].forEach(function (j) {
        var v = new Image();
        v.src = poze[(j + poze.length) % poze.length].src;
      });
    }
    strat.classList.toggle("lb-una", poze.length < 2);
  }

  function deschide(lista, i) {
    poze = lista;
    deschis = true;
    arata(i);
    strat.classList.add("activ");
    document.documentElement.classList.add("lb-blocat");
    strat.querySelector(".lb-inchide").focus();
  }

  function inchide() {
    deschis = false;
    strat.classList.remove("activ");
    document.documentElement.classList.remove("lb-blocat");
    // eliberează memoria pe telefoane
    lbImg.removeAttribute("src");
  }

  strat.querySelector(".lb-inchide").addEventListener("click", inchide);
  strat.querySelector(".lb-inapoi").addEventListener("click", function () { arata(idx - 1); });
  strat.querySelector(".lb-inainte").addEventListener("click", function () { arata(idx + 1); });
  // click pe fundal (nu pe poză/butoane) închide
  strat.addEventListener("click", function (e) {
    if (e.target === strat || e.target.classList.contains("lb-cadru")) inchide();
  });

  document.addEventListener("keydown", function (e) {
    if (!deschis) return;
    if (e.key === "Escape") inchide();
    else if (e.key === "ArrowLeft") arata(idx - 1);
    else if (e.key === "ArrowRight") arata(idx + 1);
  });

  /* swipe pe telefon: stânga/dreapta schimbă poza, în jos închide */
  var tx = 0, ty = 0;
  strat.addEventListener("touchstart", function (e) {
    tx = e.changedTouches[0].clientX;
    ty = e.changedTouches[0].clientY;
  }, { passive: true });
  strat.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) arata(idx + (dx < 0 ? 1 : -1));
    else if (dy > 70 && Math.abs(dy) > Math.abs(dx)) inchide();
  }, { passive: true });

  /* ---------- leagă fiecare galerie ---------- */
  galerii.forEach(function (gal) {
    var imagini = Array.prototype.slice.call(gal.querySelectorAll("figure img"));

    // galerie fără poze (structură pregătită, dar goală): ascunde secțiunea
    if (!imagini.length) {
      var bloc = gal.closest(".gallery-block");
      if (bloc) bloc.hidden = true;
      return;
    }

    imagini.forEach(function (im, i) {
      var fig = im.closest("figure");
      fig.classList.add("lb-clicabil");
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "Mărește: " + (im.alt || "imagine din galerie"));
      fig.addEventListener("click", function () { deschide(imagini, i); });
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); deschide(imagini, i); }
      });
    });
  });
})();
