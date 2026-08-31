/* =========================================================
   Mișcarea cardurilor de sportiv pe ecranele fără cursor.
   ---------------------------------------------------------
   Pe desktop cardurile se apleacă după mouse. Pe telefon nu
   există cursor, iar atingerea nu mai face nimic: singura
   sursă de mișcare e DERULAREA, iar mișcarea se consumă o
   singură dată, la intrarea cardului în ecran.

   Totul curge dintr-o singură mărime, „drumul" — cât a
   parcurs cardul din traseul lui:
     0 = tocmai și-a arătat marginea de sus pe jos de tot;
     1 = centrul lui a ajuns în centrul ecranului.
   Se oprește la 1 și nu mai scade cât cardul urcă spre
   ieșire, deci după mijloc nimic nu se mai agită.

   La drum 0 cardul e înclinat la maximum și dunga de lucire
   stă în afara lui, pe stânga. La drum 1 cardul e perfect
   drept — „așezat" — iar dunga a ieșit deja pe dreapta. Așa,
   în momentul în care cardul e în mijloc și te uiți la el,
   toată mișcarea s-a terminat.

   Clasa „activ" ține locul lui :hover și se aprinde către
   finalul drumului, adică exact la sosire; fiindcă drumul nu
   mai scade după mijloc, rămâne aprinsă cât cardul e sus.
   ========================================================= */
(function (global) {
  "use strict";

  function pornesteDerulare(opt) {
    var card = opt.card;
    var poza = opt.poza;
    var luc = opt.lucire;
    var n = opt.nume;   // numele variabilelor CSS, diferite de la card la card
    var c = opt.coef;   // aceiași coeficienți ca pe desktop, ca mișcarea să fie identică
    if (!card) return;

    var raf = null;
    var ultimul = -1;

    /* Dunga trebuie să se vadă cât traversează, adică pe tot drumul — nu doar
       la sosire, când oricum a ieșit din card. O aprindem o dată, aici: în
       afara cardului e invizibilă oricum, deci nu deranjează la capete. */
    if (luc) luc.style.opacity = "1";

    function scrie(drum) {
      // ce a mai rămas de parcurs: 1 la intrare, 0 la sosire
      var ramas = 1 - drum;
      var px = ramas * 0.45;
      var py = ramas * 0.5;
      card.style.setProperty(n.my, (px * c.my).toFixed(2) + "deg");
      card.style.setProperty(n.mx, (py * c.mx).toFixed(2) + "deg");
      if (poza) {
        poza.style.setProperty(n.pax, (px * c.pax).toFixed(1) + "px");
        poza.style.setProperty(n.pay, (py * c.pay).toFixed(1) + "px");
      }
      /* Lucirea merge invers, de la -0,5 la 0,5: elementul e de trei ori mai
         lat decât cardul, cu banda în treimea din mijloc, deci la -0,5 banda
         stă complet în afara marginii din stânga, iar la 0,5 a ieșit pe
         dreapta. O traversare completă, exact pe durata drumului. */
      if (luc) {
        luc.style.setProperty(n.lux, (drum - 0.5).toFixed(3));
        luc.style.setProperty(n.luy, ((drum - 0.5) * 0.5).toFixed(3));
      }
      card.classList.toggle("activ", drum > 0.85);
    }

    function masoara() {
      raf = null;
      var inalt = global.innerHeight || document.documentElement.clientHeight;
      var r = card.getBoundingClientRect();
      if (r.bottom < 0) return;                 // a ieșit pe sus, nu mai are rost
      var centru = r.top + r.height / 2;
      /* Drumul: de la „marginea de sus atinge josul ecranului" (centrul
         cardului la inalt + h/2) până la „centrul cardului în centrul
         ecranului" (inalt/2). Împărțitorul e chiar lungimea acelui traseu. */
      var plecare = inalt + r.height / 2;
      var traseu = (inalt + r.height) / 2;
      var drum = traseu > 0 ? (plecare - centru) / traseu : 1;
      drum = Math.max(0, Math.min(1, drum));
      // scriem doar când s-a schimbat ceva vizibil
      if (Math.abs(drum - ultimul) < 0.004) return;
      ultimul = drum;
      scrie(drum);
    }

    function laDerulare() {
      if (!raf) raf = global.requestAnimationFrame(masoara);
    }

    global.addEventListener("scroll", laDerulare, { passive: true });
    global.addEventListener("resize", function () { ultimul = -1; laDerulare(); }, { passive: true });
    masoara();
  }

  global.CardMiscare = { pornesteDerulare: pornesteDerulare };
})(window);
