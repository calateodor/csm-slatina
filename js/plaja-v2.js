/* =========================================================
   Plaja Olt v2 — tranziții swipe între capitole + parallax
   Fiecare bandă (.wipe) traversează ecranul exact cât timp
   capitolul ei intră în viewport (scrub), ca un obiect
   defocalizat care trece prin fața camerei.
   ========================================================= */
(function () {
  "use strict";

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

  /* ---------- benzile swipe: traversează ecranul cât capitolul intră în cadru ---------- */
  document.querySelectorAll(".wipe").forEach(function (wipe) {
    var target = document.querySelector(wipe.getAttribute("data-wipe"));
    if (!target) return;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: target,
        start: "top 95%",
        end: "top 5%",
        scrub: 0.4
      }
    });
    // cele două dâre merg cu viteze diferite — dă adâncime trecerii;
    // capetele curselor scot banda complet din orice ecran
    tl.fromTo(wipe.querySelector(".s1"),
        { xPercent: -220 }, { xPercent: 340, ease: "none" }, 0)
      .fromTo(wipe.querySelector(".s2"),
        { xPercent: -440 }, { xPercent: 620, ease: "none" }, 0.05);
    // abia acum, cu pozițiile puse de GSAP, benzile pot deveni vizibile
    gsap.set(wipe.querySelectorAll(".streak"), { visibility: "visible" });
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

  /* ---------- intrări simple pentru conținutul capitolelor ---------- */
  gsap.utils.toArray([".v2-harta .container", ".v2-servicii .container", ".v2-plaja .container"]).forEach(function (el) {
    gsap.from(el, {
      y: 50, opacity: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%", once: true }
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
