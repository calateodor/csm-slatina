/* =========================================================
   Padel CSM Slatina — logica widgetului de rezervare
   Pași: 1) dată + teren + oră  2) date personale
         3) cod SMS  4) confirmare
   ---------------------------------------------------------
   Trimiterea SMS rulează în MOD DEMONSTRATIV: codul este
   afișat într-o bulă pe ecran. Pentru SMS real, înlocuiește
   funcția sendSms() cu integrarea aleasă (Firebase Phone
   Auth, Twilio Verify etc.).
   ========================================================= */
(function () {
  "use strict";
  var S = window.PadelStore;
  var app = document.getElementById("booking-app");
  if (!S || !app) return;

  var state = {
    step: 1,
    date: null, court: 1, slot: null,
    nume: "", prenume: "", telefon: "",
    code: null, tries: 0, resends: 0,
    booking: null
  };

  var els = {
    steps: app.querySelectorAll(".booking-steps .st"),
    panels: app.querySelectorAll(".bk-panel"),
    dateStrip: app.querySelector(".date-strip"),
    courts: app.querySelectorAll(".court-btn"),
    slotGrid: app.querySelector(".slot-grid"),
    toStep2: document.getElementById("bk-to-2"),
    err1: document.getElementById("bk-err-1"),
    form: document.getElementById("bk-form"),
    err2: document.getElementById("bk-err-2"),
    back2: document.getElementById("bk-back-2"),
    summary3: document.getElementById("bk-summary-3"),
    codeInputs: app.querySelectorAll(".code-inputs input"),
    verify: document.getElementById("bk-verify"),
    resend: document.getElementById("bk-resend"),
    err3: document.getElementById("bk-err-3"),
    back3: document.getElementById("bk-back-3"),
    doneBox: document.getElementById("bk-done")
  };

  var MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
  var DAYS = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

  /* ---------- pasul 1: dată, teren, oră ---------- */
  function buildDates() {
    var html = "";
    var now = new Date();
    for (var i = 0; i < 14; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var ds = S.toDateStr(d);
      html += '<button type="button" class="date-chip" data-date="' + ds + '">' +
        "<small>" + (i === 0 ? "Azi" : DAYS[d.getDay()]) + "</small>" +
        "<strong>" + d.getDate() + "</strong>" +
        "<small>" + MONTHS[d.getMonth()] + "</small></button>";
    }
    els.dateStrip.innerHTML = html;
    els.dateStrip.querySelectorAll(".date-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.date = btn.getAttribute("data-date");
        state.slot = null;
        els.dateStrip.querySelectorAll(".date-chip").forEach(function (b) { b.classList.remove("sel"); });
        btn.classList.add("sel");
        buildSlots();
      });
    });
    // preselectăm azi
    els.dateStrip.querySelector(".date-chip").click();
  }

  function buildSlots() {
    var now = new Date();
    var today = S.toDateStr(now);
    var html = "";
    S.SLOTS.forEach(function (slot) {
      var past = state.date === today && parseInt(slot, 10) <= now.getHours();
      var free = S.isFree(state.date, slot, state.court);
      var dis = past || !free;
      html += '<button type="button" class="slot' + (state.slot === slot ? " sel" : "") + '" data-slot="' + slot + '"' + (dis ? " disabled" : "") + ">" + slot + "</button>";
    });
    els.slotGrid.innerHTML = html;
    els.slotGrid.querySelectorAll(".slot:not(:disabled)").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.slot = btn.getAttribute("data-slot");
        els.slotGrid.querySelectorAll(".slot").forEach(function (b) { b.classList.remove("sel"); });
        btn.classList.add("sel");
        els.err1.textContent = "";
      });
    });
  }

  els.courts.forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.court = parseInt(btn.getAttribute("data-court"), 10);
      state.slot = null;
      els.courts.forEach(function (b) { b.classList.remove("sel"); });
      btn.classList.add("sel");
      buildSlots();
    });
  });

  els.toStep2.addEventListener("click", function () {
    if (!state.slot) { els.err1.textContent = "Alege o oră liberă pentru rezervare."; return; }
    go(2);
  });

  /* ---------- pasul 2: date personale ---------- */
  els.form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nume = document.getElementById("bk-nume").value.trim();
    var prenume = document.getElementById("bk-prenume").value.trim();
    var telefon = document.getElementById("bk-telefon").value.trim();
    if (nume.length < 2 || prenume.length < 2) {
      els.err2.textContent = "Completează numele și prenumele."; return;
    }
    if (!/^(\+40|0)7\d{8}$/.test(telefon.replace(/[\s.-]/g, ""))) {
      els.err2.textContent = "Introdu un număr de mobil valid (ex.: 07xx xxx xxx)."; return;
    }
    if (S.countActiveForPhone(telefon) >= 2) {
      els.err2.textContent = "Acest număr are deja 2 rezervări active. Anulează una sau contactează clubul."; return;
    }
    if (!S.isFree(state.date, state.slot, state.court)) {
      els.err2.textContent = "Ora aleasă tocmai a fost ocupată. Alege alt interval."; go(1); buildSlots(); return;
    }
    state.nume = nume; state.prenume = prenume; state.telefon = telefon;
    sendSms();
    go(3);
  });
  els.back2.addEventListener("click", function () { go(1); });

  /* ---------- pasul 3: cod SMS ---------- */
  function sendSms() {
    state.code = String(Math.floor(100000 + Math.random() * 900000));
    state.tries = 0;
    /* === PUNCT DE INTEGRARE SMS REAL ===
       Aici se apelează serviciul de SMS (Firebase Phone Auth /
       Twilio Verify / SMSLink etc.) cu state.telefon.
       În modul demo, afișăm codul într-o bulă pe ecran: */
    showSmsToast(state.telefon, state.code);
    renderSummary3();
  }

  function showSmsToast(phone, code) {
    var t = document.querySelector(".sms-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "sms-toast";
      document.body.appendChild(t);
    }
    t.innerHTML = '<div class="from">SMS · simulare · către ' + phone + "</div>" +
      "Codul tău de confirmare CSM Padel este:<br><span class=\"code\">" + code + "</span>";
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 12000);
  }

  function renderSummary3() {
    var d = state.date.split("-");
    els.summary3.innerHTML =
      "<span><strong>" + d[2] + "." + d[1] + "." + d[0] + "</strong> ora <strong>" + state.slot + "</strong></span>" +
      "<span>Teren <strong>" + state.court + "</strong></span>" +
      "<span>" + state.prenume + " " + state.nume + " · " + state.telefon + "</span>";
  }

  els.codeInputs.forEach(function (inp, i) {
    inp.addEventListener("input", function () {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
      if (inp.value && i < els.codeInputs.length - 1) els.codeInputs[i + 1].focus();
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !inp.value && i > 0) els.codeInputs[i - 1].focus();
    });
    inp.addEventListener("paste", function (e) {
      var txt = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (txt.length >= 6) {
        e.preventDefault();
        els.codeInputs.forEach(function (c, j) { c.value = txt[j] || ""; });
        els.codeInputs[5].focus();
      }
    });
  });

  els.verify.addEventListener("click", function () {
    var entered = Array.prototype.map.call(els.codeInputs, function (c) { return c.value; }).join("");
    if (entered.length < 6) { els.err3.textContent = "Introdu toate cele 6 cifre din SMS."; return; }
    if (entered !== state.code) {
      state.tries++;
      if (state.tries >= 3) {
        els.err3.textContent = "Cod greșit de 3 ori. Apasă „Retrimite codul” pentru unul nou.";
      } else {
        els.err3.textContent = "Codul nu este corect. Mai încearcă.";
      }
      return;
    }
    // cod corect → salvăm rezervarea
    if (!S.isFree(state.date, state.slot, state.court)) {
      els.err3.textContent = "Între timp ora a fost ocupată. Alege alt interval."; go(1); buildSlots(); return;
    }
    state.booking = S.add({
      date: state.date, slot: state.slot, court: state.court,
      nume: state.nume, prenume: state.prenume, telefon: state.telefon
    });
    renderDone();
    go(4);
  });

  els.resend.addEventListener("click", function () {
    state.resends++;
    if (state.resends > 3) { els.err3.textContent = "Prea multe retrimiteri. Contactează clubul la 0349 738 657."; return; }
    els.codeInputs.forEach(function (c) { c.value = ""; });
    els.err3.textContent = "";
    sendSms();
  });
  els.back3.addEventListener("click", function () { go(2); });

  /* ---------- pasul 4: confirmare ---------- */
  function renderDone() {
    var b = state.booking;
    var d = b.date.split("-");
    els.doneBox.innerHTML =
      '<div class="check">✓</div>' +
      "<h3>Rezervare confirmată!</h3>" +
      '<div class="ref">' + b.ref + "</div>" +
      "<p><strong>" + d[2] + "." + d[1] + "." + d[0] + "</strong>, ora <strong>" + b.slot + " – " +
      (parseInt(b.slot, 10) + 1) + ":00</strong>, Teren " + b.court + ".<br>" +
      "Prezintă codul de mai sus la teren. Pentru anulare, sună la <a href=\"tel:+40349738657\" style=\"color:var(--lime)\">0349 738 657</a>.</p>" +
      '<div class="bk-actions" style="justify-content:center"><button type="button" class="btn btn-outline-lime" id="bk-again">Fă altă rezervare</button></div>';
    document.getElementById("bk-again").addEventListener("click", function () {
      state.slot = null; state.booking = null;
      els.codeInputs.forEach(function (c) { c.value = ""; });
      els.form.reset();
      buildSlots();
      go(1);
    });
  }

  /* ---------- navigare pași ---------- */
  function go(step) {
    state.step = step;
    els.panels.forEach(function (p) {
      p.hidden = parseInt(p.getAttribute("data-step"), 10) !== step;
    });
    els.steps.forEach(function (s, i) {
      s.classList.toggle("on", i + 1 === step);
      s.classList.toggle("done", i + 1 < step);
    });
    ["bk-err-1", "bk-err-2", "bk-err-3"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = "";
    });
    app.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  buildDates();
  go(1);
})();
