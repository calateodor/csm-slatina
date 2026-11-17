/* Hero-ul de festival de pe prima pagină: același parallax ca hero-ul
   obișnuit (main.js) — fundalul coboară și crește puțin la derulare, afișul
   urcă ușor, titlul se ridică și se stinge; pe desktop, straturile urmează
   și mouse-ul. Rulează doar cât <html> are clasa „festival". */
(function () {
  "use strict";
  var hf = document.getElementById("festival");
  if (!hf || !document.documentElement.classList.contains("festival")) return;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.timeline({
    scrollTrigger: { trigger: hf, start: "top top", end: "bottom top", scrub: 0.6 }
  })
    .fromTo(".hf-fundal", { yPercent: 0, scale: 1 },
      { yPercent: 14, scale: 1.06, ease: "none", immediateRender: false }, 0)
    .fromTo(".hf-afis", { yPercent: 0 },
      { yPercent: -8, ease: "none", immediateRender: false }, 0)
    .fromTo(".hf-titlu-strat", { yPercent: 0, opacity: 1 },
      { yPercent: -60, opacity: 0.15, ease: "none", immediateRender: false }, 0);

  // intrare la încărcare
  gsap.from(".hf-titlu-strat", { y: -30, opacity: 0, duration: 1, ease: "power3.out", delay: 0.2 });
  gsap.from(".hf-afis", { y: 70, opacity: 0, scale: 0.96, duration: 1.2, ease: "power3.out", delay: 0.35 });

  if (window.matchMedia("(pointer: fine)").matches) {
    var ax = gsap.quickTo(".hf-afis", "x", { duration: 0.7, ease: "power2.out" });
    var tx = gsap.quickTo(".hf-titlu-strat", "x", { duration: 0.9, ease: "power2.out" });
    var bx = gsap.quickTo(".hf-fundal", "x", { duration: 1.1, ease: "power2.out" });
    hf.addEventListener("mousemove", function (e) {
      var rel = e.clientX / window.innerWidth - 0.5;
      ax(rel * -18);
      tx(rel * 10);
      bx(rel * -10);
    });
  }
})();
