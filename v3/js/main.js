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

  /* ---------- Insigna „Cred în Slatina": apare după hero ---------- */
  var credFloat = document.querySelector(".cred-float");
  function onScrollCred() {
    if (!credFloat) return;
    credFloat.classList.toggle("visible", window.scrollY > window.innerHeight * 0.55);
  }
  if (credFloat) {
    window.addEventListener("scroll", onScrollCred, { passive: true });
    onScrollCred();
  }

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

  /* ---------- Marquee infinit ----------
     Clonăm setul de itemi până acoperim de două ori lățimea containerului,
     apoi deplasăm exact cu lățimea unui set (inclusiv gap-ul), ca reluarea
     să fie invizibilă indiferent de lățimea ecranului. */
  function setupMarquee(track) {
    var parent = track.parentElement;
    if (!parent) return;
    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;

    var styles = getComputedStyle(track);
    var gap = parseFloat(styles.columnGap || styles.gap) || 0;

    // lățimea unui set complet = suma lățimilor + gap-urile dintre itemi + gap-ul de legătură
    function setWidth() {
      var w = 0;
      originals.forEach(function (el) { w += el.getBoundingClientRect().width; });
      return w + gap * originals.length;
    }

    var oneSet = setWidth();
    if (oneSet <= 0) return;

    // câte seturi trebuie ca pista să depășească 2× containerul
    var needed = Math.max(2, Math.ceil((parent.getBoundingClientRect().width * 2) / oneSet) + 1);
    for (var i = 1; i < needed; i++) {
      originals.forEach(function (el) { track.appendChild(el.cloneNode(true)); });
    }

    track.style.setProperty("--marquee-shift", oneSet + "px");
    // viteză constantă (px/secundă), indiferent de câte seturi are pista
    var speed = track.classList.contains("ticker-track") ? 70 : 90;
    track.style.animationDuration = (oneSet / speed) + "s";
  }

  var marquees = document.querySelectorAll(".ticker-track, .band-track");
  marquees.forEach(setupMarquee);

  // la redimensionare recalculăm (numărul de seturi depinde de lățimea ecranului)
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      marquees.forEach(function (track) {
        var shift = parseFloat(track.style.getPropertyValue("--marquee-shift"));
        var parentW = track.parentElement.getBoundingClientRect().width;
        if (shift && track.getBoundingClientRect().width < parentW * 2 + shift) {
          // ecranul s-a lărgit peste acoperirea actuală — mai adăugăm un set
          var kids = Array.prototype.slice.call(track.children);
          var perSet = Math.round(track.children.length / Math.round(track.getBoundingClientRect().width / shift)) || kids.length;
          for (var i = 0; i < perSet && i < kids.length; i++) track.appendChild(kids[i].cloneNode(true));
        }
      });
    }, 250);
  }, { passive: true });

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
      .to(".layer-slogan", { yPercent: -46, opacity: 0.15, ease: "none" }, 0);

    // intrare la încărcare
    gsap.from(".layer-athletes", { y: 90, opacity: 0, duration: 1.2, ease: "power3.out", delay: 0.15 });
    gsap.from(".layer-slogan", { y: -40, opacity: 0, scale: 0.92, duration: 1.1, ease: "power3.out", delay: 0.45 });

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
  /* cuvintele-fantoma ale sectiunilor pline: aluneca incet orizontal cat
     timp sectiunea traverseaza ecranul — semnatura site-ului, mereu vie */
  /* filigranul eroilor (sport-ghost) primeste aceeasi alunecare orizontala;
     pe eroul-calendar ea se compune cu urcarea pe verticala pe care i-o da
     calendar-erou.js — axele diferite nu se calca */
  gsap.utils.toArray(".fantoma, .page-hero .sport-ghost")
    .forEach(function (f) {
      // sport-ghost e centrat din CSS cu translateY(-50%); trecut explicit in
      // yPercent, altfel GSAP citeste procentul ca pixeli si filigranul sare
      if (f.classList.contains("sport-ghost")) gsap.set(f, { yPercent: -50, y: 0 });
      gsap.fromTo(f, { xPercent: 4 }, {
        xPercent: -10, ease: "none",
        scrollTrigger: {
          trigger: f.closest("section") || f.parentElement,
          start: "top bottom", end: "bottom top", scrub: true
        }
      });
    });

  gsap.utils.toArray(".reveal").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
      delay: parseFloat(el.getAttribute("data-delay")) || 0,
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
