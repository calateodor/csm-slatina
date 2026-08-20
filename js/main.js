/* =========================================================
   CSM Slatina — animații & interacțiuni
   GSAP + ScrollTrigger
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof gsap !== "undefined";

  if (hasGsap && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------- Anul curent în footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header: fundal la scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- Meniu overlay ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var overlay = document.querySelector(".menu-overlay");
  if (toggle && overlay) {
    var menuItems = overlay.querySelectorAll(".menu-primary li, .menu-sections, .menu-contact");
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Închide meniul" : "Deschide meniul");
      document.body.style.overflow = open ? "hidden" : "";
      if (open && hasGsap && !reduceMotion) {
        gsap.fromTo(menuItems,
          { y: 42, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: "power3.out", delay: 0.15, overwrite: true });
      }
    });
    // închide meniul la click pe un link sau cu Escape
    function closeMenu() {
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Deschide meniul");
    }
    overlay.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) closeMenu();
    });
  }

  /* ---------- Dublăm pistele de marquee pt. buclă continuă ---------- */
  document.querySelectorAll(".ticker-track, .band-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    if (!q || !a) return;
    q.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (other) {
        other.classList.remove("open");
        other.querySelector(".faq-a").style.maxHeight = null;
        other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
        q.setAttribute("aria-expanded", "true");
      }
    });
  });

  if (!hasGsap || reduceMotion) {
    // fără animații: arată tot conținutul
    document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .sport-card, .plaja-item").forEach(function (el) {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
    return;
  }

  /* =========================================================
     Hero parallax (scrub pe scroll + parallax la mouse)
     ========================================================= */
  var hero = document.querySelector(".hero");
  if (hero) {
    var heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.6
      }
    });
    heroTl
      .to(".layer-bg", { yPercent: 14, scale: 1.06, ease: "none" }, 0)
      .to(".layer-athletes", { yPercent: -6, ease: "none" }, 0)
      .to(".layer-slogan", { yPercent: -46, opacity: 0.15, ease: "none" }, 0)
      .to(".scroll-badge", { opacity: 0, ease: "none" }, 0);

    // intrare la încărcare
    gsap.from(".layer-athletes", { y: 90, opacity: 0, duration: 1.2, ease: "power3.out", delay: 0.15 });
    gsap.from(".layer-slogan", { y: -40, opacity: 0, scale: 0.92, duration: 1.1, ease: "power3.out", delay: 0.45 });
    gsap.from(".scroll-badge", { opacity: 0, duration: 0.8, delay: 1.1 });

    // parallax subtil la mișcarea mouse-ului (doar desktop)
    if (window.matchMedia("(pointer: fine)").matches) {
      var mx = gsap.quickTo(".layer-athletes", "x", { duration: 0.6, ease: "power2.out" });
      var sx = gsap.quickTo(".layer-slogan", "x", { duration: 0.9, ease: "power2.out" });
      var bx = gsap.quickTo(".layer-bg", "x", { duration: 1.1, ease: "power2.out" });
      hero.addEventListener("mousemove", function (e) {
        var rel = (e.clientX / window.innerWidth - 0.5);
        mx(rel * -26);
        sx(rel * 14);
        bx(rel * -10);
      });
    }
  }

  /* =========================================================
     Reveal-uri generale
     ========================================================= */
  gsap.utils.toArray(".reveal").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });
  gsap.utils.toArray(".reveal-left").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, x: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%", once: true }
    });
  });
  gsap.utils.toArray(".reveal-right").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, x: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%", once: true }
    });
  });

  /* ---------- Carduri secții: stagger ---------- */
  ScrollTrigger.batch(".sport-card", {
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.75, stagger: 0.08, ease: "power3.out", overwrite: true });
    }
  });

  /* ---------- Plaja Olt: stagger ---------- */
  ScrollTrigger.batch(".plaja-item", {
    start: "top 92%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "power2.out", overwrite: true });
    }
  });

  /* ---------- Benzile diagonale: intră din lateral ---------- */
  gsap.utils.toArray(".band").forEach(function (band, i) {
    gsap.from(band, {
      xPercent: i % 2 === 0 ? -12 : 12,
      opacity: 0,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: { trigger: band.parentElement, start: "top 75%", once: true }
    });
  });

  /* ---------- Contoare ---------- */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var obj = { val: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: function () {
        gsap.to(obj, {
          val: target,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: function () {
            var v = Math.round(obj.val);
            el.textContent = target >= 1000 ? v.toLocaleString("ro-RO") : v;
          }
        });
      }
    });
  });

  /* ---------- CTA banner: fundal cu parallax ---------- */
  var ctaBg = document.querySelector(".cta-banner .cta-bg");
  if (ctaBg) {
    gsap.to(ctaBg, {
      yPercent: 18, ease: "none",
      scrollTrigger: { trigger: ".cta-banner", start: "top bottom", end: "bottom top", scrub: true }
    });
  }

  /* ---------- Banda de tranziție Plaja Olt: parallax ușor ---------- */
  var trans = document.querySelector(".plaja-transition");
  if (trans) {
    gsap.from(trans, {
      yPercent: 8, ease: "none",
      scrollTrigger: { trigger: trans, start: "top bottom", end: "bottom top", scrub: true }
    });
  }
})();
