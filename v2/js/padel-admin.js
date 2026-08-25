/* =========================================================
   Padel CSM Slatina — panoul de administrare
   Acces pe bază de PIN (implicit 2009, se poate schimba din
   panou). Datele vin din PadelStore (js/padel-store.js).
   ========================================================= */
(function () {
  "use strict";
  var S = window.PadelStore;
  if (!S) return;

  var PIN_KEY = "csmPadelAdminPin";
  var SESSION_KEY = "csmPadelAdminOk";

  function getPin() { return localStorage.getItem(PIN_KEY) || "2009"; }

  var gate = document.getElementById("gate");
  var panel = document.getElementById("panel");
  var pinInput = document.getElementById("gate-pin");
  var gateErr = document.getElementById("gate-err");

  function tryEnter() {
    if (pinInput.value === getPin()) {
      sessionStorage.setItem(SESSION_KEY, "1");
      openPanel();
    } else {
      gateErr.textContent = "PIN greșit.";
      pinInput.value = "";
      pinInput.focus();
    }
  }
  document.getElementById("gate-enter").addEventListener("click", tryEnter);
  pinInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryEnter(); });

  function openPanel() {
    gate.hidden = true;
    panel.hidden = false;
    renderAll();
  }

  document.getElementById("btn-logout").addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);
    panel.hidden = true;
    gate.hidden = false;
    pinInput.value = "";
  });

  document.getElementById("btn-pin").addEventListener("click", function () {
    var np = prompt("Noul cod PIN (4–8 cifre):");
    if (np === null) return;
    if (!/^\d{4,8}$/.test(np)) { alert("PIN-ul trebuie să aibă între 4 și 8 cifre."); return; }
    localStorage.setItem(PIN_KEY, np);
    alert("PIN schimbat.");
  });

  document.getElementById("btn-export").addEventListener("click", function () {
    var blob = new Blob(["﻿" + S.exportCsv()], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rezervari-padel-csm-slatina.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  /* ---------- Tabla zilei ---------- */
  var dayPick = document.getElementById("day-pick");
  var board = document.getElementById("board");
  var blockSlot = document.getElementById("block-slot");
  var blockCourt = document.getElementById("block-court");
  var blockMotiv = document.getElementById("block-motiv");

  dayPick.value = S.toDateStr(new Date());
  S.SLOTS.forEach(function (s) {
    var o = document.createElement("option");
    o.value = s; o.textContent = s;
    blockSlot.appendChild(o);
  });

  dayPick.addEventListener("change", renderBoard);

  document.getElementById("btn-block").addEventListener("click", function () {
    var date = dayPick.value;
    if (!date) return;
    var slot = blockSlot.value;
    var court = parseInt(blockCourt.value, 10);
    if (S.bookingAt(date, slot, court)) {
      alert("Există deja o rezervare confirmată pe acest interval. Anuleaz-o întâi.");
      return;
    }
    S.block(date, slot, court, blockMotiv.value.trim());
    blockMotiv.value = "";
    renderAll();
  });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderBoard() {
    var date = dayPick.value;
    var html = "";
    S.COURTS.forEach(function (court) {
      html += '<div><h3>Teren ' + court + "</h3>";
      S.SLOTS.forEach(function (slot) {
        var b = S.bookingAt(date, slot, court);
        var bl = S.blockAt(date, slot, court);
        if (b) {
          html += '<div class="aslot"><span class="t">' + slot + '</span><span class="who">' +
            esc(b.prenume + " " + b.nume) + "<small>" + esc(b.telefon) + " · " + b.ref + "</small></span>" +
            '<button type="button" class="abtn danger" data-cancel="' + b.id + '">Anulează</button></div>';
        } else if (bl) {
          html += '<div class="aslot blocked"><span class="t">' + slot + '</span><span class="who">Blocat' +
            (bl.motiv ? " — " + esc(bl.motiv) : "") + "</span>" +
            '<button type="button" class="abtn" data-unblock="' + slot + "|" + court + '">Deblochează</button></div>';
        } else {
          html += '<div class="aslot free"><span class="t">' + slot + '</span><span class="who">liber</span><span></span></div>';
        }
      });
      html += "</div>";
    });
    board.innerHTML = html;

    board.querySelectorAll("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (confirm("Anulezi această rezervare?")) {
          S.cancel(btn.getAttribute("data-cancel"));
          renderAll();
        }
      });
    });
    board.querySelectorAll("[data-unblock]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parts = btn.getAttribute("data-unblock").split("|");
        S.unblock(dayPick.value, parts[0], parseInt(parts[1], 10));
        renderAll();
      });
    });
  }

  /* ---------- Lista completă ---------- */
  var search = document.getElementById("search");
  var filterStatus = document.getElementById("filter-status");
  var rows = document.getElementById("rows");
  var rowsEmpty = document.getElementById("rows-empty");

  search.addEventListener("input", renderRows);
  filterStatus.addEventListener("change", renderRows);

  function renderRows() {
    var q = search.value.trim().toLowerCase();
    var st = filterStatus.value;
    var list = S.all().sort(function (a, b) {
      return (b.date + b.slot).localeCompare(a.date + a.slot);
    }).filter(function (b) {
      if (st && b.status !== st) return false;
      if (!q) return true;
      return (b.nume + " " + b.prenume + " " + b.telefon + " " + b.ref).toLowerCase().indexOf(q) !== -1;
    });

    rows.innerHTML = list.map(function (b) {
      var d = b.date.split("-");
      return "<tr><td>" + b.ref + "</td><td>" + d[2] + "." + d[1] + "." + d[0] + "</td><td>" + b.slot +
        "</td><td>Teren " + b.court + "</td><td>" + esc(b.prenume + " " + b.nume) + "</td><td>" + esc(b.telefon) +
        '</td><td class="st-' + b.status + '">' + b.status +
        "</td><td>" + (b.status === "confirmata"
          ? '<button type="button" class="abtn danger" data-cancel="' + b.id + '">Anulează</button>'
          : "") + "</td></tr>";
    }).join("");
    rowsEmpty.hidden = list.length > 0;

    rows.querySelectorAll("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (confirm("Anulezi această rezervare?")) {
          S.cancel(btn.getAttribute("data-cancel"));
          renderAll();
        }
      });
    });
  }

  /* ---------- Statistici ---------- */
  function renderStats() {
    var today = S.toDateStr(new Date());
    var active = S.activeBookings();
    document.getElementById("stat-azi").textContent = active.filter(function (b) { return b.date === today; }).length;
    document.getElementById("stat-active").textContent = active.length;
    document.getElementById("stat-blocate").textContent = S.blockedAll().filter(function (x) { return x.date >= today; }).length;
  }

  function renderAll() {
    renderStats();
    renderBoard();
    renderRows();
  }

  if (sessionStorage.getItem(SESSION_KEY) === "1") openPanel();
  else pinInput.focus();
})();
