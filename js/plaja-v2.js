/* =========================================================
   Plaja Olt v2 — tranziții swipe între capitole + parallax
   Fiecare bandă (.wipe) traversează ecranul exact cât timp
   capitolul ei intră în viewport (scrub), ca un obiect
   defocalizat care trece prin fața camerei.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- serviciile: acordeon pe desktop, carusel-acordeon pe telefon ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".v2-card"));
  var eTelefon = window.matchMedia("(max-width: 640px)");
  var banda = document.querySelector(".v2-cards");
  var cutieDots = document.querySelector(".v2-dots");
  var marcheazaDot = function () {};
  var mergiLa = null;      // setat de caruselul-acordeon (mai jos, doar pe telefon)
  var aFostTras = false;   // deosebește un swipe de o atingere

  function deschide(card) {
    if (eTelefon.matches) return;
    cards.forEach(function (c) { c.classList.toggle("is-open", c === card); });
  }
  cards.forEach(function (card, i) {
    card.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") deschide(card);
    });
    card.addEventListener("click", function (e) {
      if (eTelefon.matches) {
        // atingerea pe o fâșie închisă o aduce în față; pe cardul activ linkul merge normal
        if (mergiLa && !aFostTras && !card.classList.contains("acc-in-fata")) {
          e.preventDefault();
          mergiLa(i);
        }
        return;
      }
      if (!card.classList.contains("is-open")) { e.preventDefault(); deschide(card); }
    });
    card.addEventListener("focusin", function () { deschide(card); });
  });
  if (cards.length) cards[0].classList.add("is-open");

  /* punctele: arată cardul din față și sar la el la atingere */
  if (banda && cutieDots && cards.length) {
    var dots = cards.map(function (card, i) {
      var d = document.createElement("span");
      d.className = "dot" + (i === 0 ? " activ" : "");
      d.addEventListener("click", function () {
        if (mergiLa) { mergiLa(i); return; }
        banda.scrollTo({ left: card.offsetLeft - (banda.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
      });
      cutieDots.appendChild(d);
      return d;
    });
    marcheazaDot = function (idx) {
      dots.forEach(function (d, i) { d.classList.toggle("activ", i === idx); });
    };
    // sincronizare pentru caruselul nativ (fallback-ul fără animații)
    banda.addEventListener("scroll", function () {
      requestAnimationFrame(function () {
        if (mergiLa || !eTelefon.matches) return;
        var mijloc = banda.scrollLeft + banda.clientWidth / 2;
        var aproape = 0, best = Infinity;
        cards.forEach(function (c, i) {
          var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mijloc);
          if (d < best) { best = d; aproape = i; }
        });
        marcheazaDot(aproape);
      });
    }, { passive: true });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined" || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- telefonul: carusel-acordeon ----------
     Cardul din dreptul centrului e extins și își arată conținutul; vecinii se
     îngustează continuu în fâșii cu eticheta pe verticală. Glisarea (sau o
     atingere pe fâșie / pe un punct) mută cardul deschis, cu animație. */
  if (eTelefon.matches && banda && cards.length) {
    banda.classList.add("acc-activ");
    var nAcc = cards.length;
    var poz = { p: 0 };
    var GOL = 8, MARGINE = 12;
    // cat de mult misca degetul caruselul: mai mare = mai lent, mai controlat
    var SENS = 1;

    var geometrie = function () {
      var W = banda.clientWidth;
      var MAXW = Math.min(W * 0.62, 300), MINW = 60;
      var latimi = cards.map(function (c, i) {
        var o = Math.max(0, 1 - Math.abs(i - poz.p));
        o = o * o * (3 - 2 * o); // smoothstep — lățirea se simte organică
        return MINW + (MAXW - MINW) * o;
      });
      var xs = [], acc = 0;
      latimi.forEach(function (w) { xs.push(acc); acc += w + GOL; });
      var fl = Math.max(0, Math.min(nAcc - 1, Math.floor(poz.p)));
      var ce = Math.min(fl + 1, nAcc - 1), fr = poz.p - fl;
      var centru = (xs[fl] + latimi[fl] / 2) * (1 - fr) + (xs[ce] + latimi[ce] / 2) * fr;
      var T = W / 2 - centru;
      T = Math.min(MARGINE, Math.max(W - (acc - GOL) - MARGINE, T));
      return { latimi: latimi, T: T };
    };
    var randeaza = function () {
      var g = geometrie();
      cards.forEach(function (c, i) {
        gsap.set(c, { width: g.latimi[i], x: g.T });
        var o = Math.max(0, 1 - Math.abs(i - poz.p));
        var copy = c.querySelector(".v2-card-copy");
        var vert = c.querySelector(".v2-vert");
        if (copy) {
          copy.style.opacity = o < 0.55 ? 0 : (o - 0.55) / 0.45;
          copy.style.pointerEvents = o > 0.9 ? "auto" : "none";
        }
        if (vert) vert.style.opacity = o > 0.55 ? 0 : 1 - o / 0.55;
        c.classList.toggle("acc-in-fata", Math.abs(i - poz.p) < 0.5);
      });
      marcheazaDot(Math.round(poz.p));
    };
    mergiLa = function (idx) {
      idx = Math.max(0, Math.min(nAcc - 1, idx));
      inDrag = false;
      gsap.to(poz, { p: idx, duration: 0.65, ease: "power4.out", overwrite: true, onUpdate: randeaza });
    };

    /* glisare cu inerție: degetul mută doar o țintă, iar poziția reală o
       urmărește cu întârziere exponențială, cadru cu cadru — de aici vine
       senzația de greutate și cursivitate, în loc de saltul 1:1 după deget */
    var tinta = 0, inDrag = false;
    gsap.ticker.add(function (t, dt) {
      if (!inDrag) return;
      var dif = tinta - poz.p;
      if (Math.abs(dif) < 0.0004) return;
      poz.p += dif * (1 - Math.exp(-(dt / 1000) * 14));
      randeaza();
    });

    var pX = 0, pY = 0, pT = 0, uX = 0, uT = 0, vit = 0, sens = null, apasat = false;
    banda.addEventListener("pointerdown", function (e) {
      apasat = true; sens = null; aFostTras = false;
      pX = uX = e.clientX; pY = e.clientY; uT = e.timeStamp; vit = 0;
      gsap.killTweensOf(poz);
      pT = tinta = poz.p;
    });
    banda.addEventListener("pointermove", function (e) {
      if (!apasat) return;
      var dx = e.clientX - pX, dy = e.clientY - pY;
      if (sens === null) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        sens = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (sens === "h") {
          inDrag = true;
          if (banda.setPointerCapture) {
            try { banda.setPointerCapture(e.pointerId); } catch (err) {}
          }
        }
      }
      if (sens !== "h") return;
      aFostTras = true;
      // viteza netezită pe mai multe evenimente — flick-ul nu depinde de un singur cadru
      var inst = (e.clientX - uX) / Math.max(1, e.timeStamp - uT);
      vit = vit * 0.75 + inst * 0.25;
      uX = e.clientX; uT = e.timeStamp;
      var brut = pT - dx / (banda.clientWidth * SENS);
      // dincolo de capete banda opune rezistență, ca un elastic
      if (brut < 0) brut *= 0.32;
      else if (brut > nAcc - 1) brut = (nAcc - 1) + (brut - (nAcc - 1)) * 0.32;
      tinta = brut;
    });
    var eliberare = function () {
      if (!apasat) return;
      apasat = false;
      if (sens === "h") {
        inDrag = false;
        // proiecția inerției alege cardul, dar sare cel mult unul față de cel curent
        var vitCarduri = -vit * 1000 / (banda.clientWidth * SENS);
        var baza = Math.round(tinta);
        var idx = Math.max(baza - 1, Math.min(baza + 1, Math.round(tinta + vitCarduri * 0.14)));
        idx = Math.max(0, Math.min(nAcc - 1, idx));
        gsap.to(poz, {
          p: idx,
          duration: 0.55 + Math.min(0.25, Math.abs(idx - poz.p) * 0.12),
          ease: "power4.out",
          overwrite: true,
          onUpdate: randeaza
        });
        setTimeout(function () { aFostTras = false; }, 80);
      }
      sens = null;
    };
    banda.addEventListener("pointerup", eliberare);
    banda.addEventListener("pointercancel", eliberare);
    window.addEventListener("resize", randeaza);
    randeaza();
  }

  /* ---------- hero: efect de dronă (imaginea coboară și se apropie de scara reală) ---------- */
  gsap.to(".v2-aer img", {
    scale: 1.02,
    yPercent: 7,
    ease: "none",
    scrollTrigger: {
      trigger: ".v2-hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.5
    }
  });
  gsap.to(".v2-hero-copy", {
    yPercent: -40,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: ".v2-hero", start: "top top", end: "70% top", scrub: 0.5 }
  });
  gsap.from(".v2-hero-copy", { y: 60, opacity: 0, duration: 1.1, ease: "power3.out", delay: 0.2 });

  /* ---------- linia-divizor + fundalul capitolului, sudate ----------
     Fundalul fiecărui capitol e un strat fix (în .bg-stage) dezvăluit prin
     clip-path exact la linia cu glow. Cursa se încheie lângă marginea de sus a
     ecranului și ține 45% din înălțimea capitolului — proporția rămâne aceeași
     indiferent cât de scurte sunt secțiunile. Fundalul vechi stă pe loc până e
     acoperit. */
  document.body.classList.add("bg-fx");

  // poziția în document, independentă de scroll (ScrollTrigger recalculează la refresh)
  function pozitieInPagina(el) {
    var t = 0;
    while (el) { t += el.offsetTop; el = el.offsetParent; }
    return t;
  }

  document.querySelectorAll(".wipe").forEach(function (wipe) {
    var sel = wipe.getAttribute("data-wipe");
    var target = document.querySelector(sel);
    var layer = document.querySelector('.bg-layer[data-bg="' + sel + '"]');
    if (!target || !layer) return;
    gsap.set(layer, { visibility: "visible" });
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: target,
        // bara pornește exact când capitolul următor se ivește la marginea de
        // jos (marginea lui de sus la 78% din ecran) și se termină lângă cea de
        // sus — aceeași cursă la fiecare graniță, deci același ritm peste tot
        start: function () {
          var vh = window.innerHeight;
          // cursa nu poate depăși capitolul de deasupra, altfel două bare ar fi
          // pe ecran în același timp (se întâmplă pe telefon, unde e mai scurt)
          var prec = target.previousElementSibling;
          var maxim = prec ? prec.offsetHeight : vh;
          return Math.max(0, pozitieInPagina(target) - Math.min(vh * 0.78, maxim));
        },
        end: function () {
          return pozitieInPagina(target) - window.innerHeight * 0.05;
        },
        scrub: 0.4,
        invalidateOnRefresh: true
      }
    });
    var linie = wipe.querySelector(".streak");
    // fundalul nou se dezvăluie de jos în sus, cu linia pe muchia lui
    tl.fromTo(layer, { clipPath: "inset(100% 0% 0% 0%)" },
                     { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "none" }, 0)
      .fromTo(linie, { top: "100%" }, { top: "0%", duration: 1, ease: "none" }, 0)
      .fromTo(linie, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06, ease: "none" }, 0.02)
      .to(linie, { autoAlpha: 0, duration: 0.08, ease: "none" }, 0.92);
  });

  /* ---------- fundalurile capitolelor: același parallax de dronă ca imaginea de sus ---------- */
  document.querySelectorAll(".bg-layer[data-bg] .bg-inner").forEach(function (inner) {
    var sec = document.querySelector(inner.parentElement.getAttribute("data-bg"));
    if (!sec) return;
    gsap.fromTo(inner, { scale: 1.16, yPercent: 0 }, {
      scale: 1.02, yPercent: 7, ease: "none",
      scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.5 }
    });
  });

  /* ---------- cuvintele-fantomă: alunecă orizontal prin capitol ---------- */
  gsap.utils.toArray(".v2-ghost").forEach(function (ghost) {
    gsap.fromTo(ghost, { xPercent: 6 }, {
      xPercent: -18,
      ease: "none",
      scrollTrigger: {
        trigger: ghost.parentElement,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  });

  /* ---------- pozele din carduri: parallax discret în interiorul măștii ---------- */
  gsap.utils.toArray(".v2-card img").forEach(function (img) {
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 0,
      ease: "none",
      scrollTrigger: {
        trigger: img.closest(".v2-card"),
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  });

  /* ---------- capitolele se despart cu parallax: conținutul plutește în ritm propriu ---------- */
  gsap.utils.toArray([".v2-harta > .container", ".v2-servicii > .container", ".v2-plaja > .container"]).forEach(function (el) {
    gsap.fromTo(el, { y: 90 }, {
      y: -50, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true }
    });
    gsap.fromTo(el, { autoAlpha: 0 }, {
      autoAlpha: 1, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top 75%", end: "top 40%", scrub: true }
    });
  });
  ScrollTrigger.batch(".v2-card", {
    start: "top 92%",
    once: true,
    onEnter: function (batch) {
      gsap.from(batch, { y: 60, opacity: 0, duration: 0.8, stagger: 0.09, ease: "power3.out" });
    }
  });
  gsap.from(".v2-party", {
    x: 60, opacity: 0, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".v2-party", start: "top 85%", once: true }
  });
})();
