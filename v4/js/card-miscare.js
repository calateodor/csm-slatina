/* =========================================================
   Mișcarea cardurilor de sportiv pe ecranele fără cursor.
   ---------------------------------------------------------
   Pe desktop cardurile se apleacă după mouse. Pe telefon nu
   există cursor, deci efectele stăteau stinse — cardul era o
   poză moartă. Aici le dăm două surse de mișcare:

   1. DERULAREA. Cât timp cardul traversează ecranul, unghiul
      lui iese din poziția pe verticală: sub mijloc se apleacă
      într-un fel, deasupra în celălalt, iar la trecerea prin
      centru e drept. Poza plutește în parallax și dunga de
      lucire mătură cardul, din aceeași valoare — deci lumina
      și înclinarea rămân coerente.
   2. DEGETUL. Cât ții apăsat pe card, el preia controlul și
      urmărește degetul, exact ca mouse-ul pe desktop. La
      ridicare revine lin la unghiul dat de derulare.

   Nu chemăm preventDefault pe atingeri: pagina trebuie să se
   poată derula normal chiar cu degetul pe card. De aceea toate
   ascultătoarele sunt pasive, iar conflictul dintre cele două
   surse se rezolvă printr-un simplu comutator — cât degetul e
   jos, derularea nu mai scrie nimic.

   Clasa „activ" ține locul lui :hover: se aprinde cât cardul e
   pe la mijlocul ecranului, adică exact cât te uiți la el.
   ========================================================= */
(function (global) {
  "use strict";

  function pornesteTouch(opt) {
    var card = opt.card;
    var poza = opt.poza;
    var luc = opt.lucire;
    var n = opt.nume;   // numele variabilelor CSS, diferite de la card la card
    var c = opt.coef;   // aceiași coeficienți ca pe desktop, ca mișcarea să fie identică
    if (!card) return;

    var manual = false;
    var raf = null;

    /* px/py sunt fracțiuni -0,5..0,5, exact ca la mouse — așa, coeficienții
       de pe desktop se refolosesc fără nicio conversie. */
    function scrie(px, py) {
      card.style.setProperty(n.my, (px * c.my).toFixed(2) + "deg");
      card.style.setProperty(n.mx, (py * c.mx).toFixed(2) + "deg");
      if (poza) {
        poza.style.setProperty(n.pax, (px * c.pax).toFixed(1) + "px");
        poza.style.setProperty(n.pay, (py * c.pay).toFixed(1) + "px");
      }
      if (luc) {
        luc.style.setProperty(n.lux, px.toFixed(3));
        luc.style.setProperty(n.luy, py.toFixed(3));
      }
    }

    function dinDerulare() {
      raf = null;
      if (manual) return;               // degetul are prioritate
      var inalt = global.innerHeight || document.documentElement.clientHeight;
      var r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > inalt) return;   // în afara ecranului, nu scriem degeaba
      var centru = r.top + r.height / 2;
      var t = (centru - inalt / 2) / (inalt / 2);
      t = Math.max(-1, Math.min(1, t));
      // 0,45 și 0,5 țin unghiurile în aceeași plajă ca la mouse (±9° / ±6°)
      scrie(t * 0.45, t * 0.5);
      // „activ" cât cardul e pe la mijloc — echivalentul lui :hover
      card.classList.toggle("activ", Math.abs(centru - inalt / 2) < inalt * 0.3);
    }

    function laDerulare() {
      if (!raf) raf = global.requestAnimationFrame(dinDerulare);
    }

    global.addEventListener("scroll", laDerulare, { passive: true });
    global.addEventListener("resize", laDerulare, { passive: true });
    dinDerulare();

    function dinAtingere(ev) {
      var a = ev.touches && ev.touches[0];
      if (!a) return;
      var r = card.getBoundingClientRect();
      scrie((a.clientX - r.left) / r.width - 0.5, (a.clientY - r.top) / r.height - 0.5);
    }

    card.addEventListener("touchstart", function (ev) {
      manual = true;
      card.classList.add("urmareste", "activ");
      dinAtingere(ev);
    }, { passive: true });

    card.addEventListener("touchmove", dinAtingere, { passive: true });

    function gata() {
      if (!manual) return;
      manual = false;
      // scoatem „urmareste" ca tranziția lungă să readucă lin cardul
      card.classList.remove("urmareste");
      laDerulare();
    }
    card.addEventListener("touchend", gata, { passive: true });
    card.addEventListener("touchcancel", gata, { passive: true });
  }

  global.CardMiscare = { pornesteTouch: pornesteTouch };
})(window);
