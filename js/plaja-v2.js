/* =========================================================
   Plaja Olt v2 — tranziții swipe între capitole + parallax
   Fiecare bandă (.wipe) traversează ecranul exact cât timp
   capitolul ei intră în viewport (scrub), ca un obiect
   defocalizat care trece prin fața camerei.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- acordeonul de servicii: hover pe desktop, atingere pe mobil ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".v2-card"));
  function deschide(card) {
    cards.forEach(function (c) { c.classList.toggle("is-open", c === card); });
  }
  cards.forEach(function (card) {
    card.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") deschide(card);
    });
    card.addEventListener("click", function (e) {
      if (!card.classList.contains("is-open")) { e.preventDefault(); deschide(card); }
    });
    card.addEventListener("focusin", function () { deschide(card); });
  });
  if (cards.length) deschide(cards[0]);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined" || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

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
        // cursa ține 45% din înălțimea capitolului, nu o felie fixă de ecran:
        // așa liniile păstrează același ritm oricât de scurte sunt secțiunile
        start: function () {
          var vh = window.innerHeight;
          var final = pozitieInPagina(target) - vh * 0.05;
          var cursa = gsap.utils.clamp(vh * 0.32, vh * 0.6, target.offsetHeight * 0.45);
          return Math.max(0, final - cursa);
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
