/* =========================================================
   Padel CSM Slatina — stratul de date al rezervărilor
   ---------------------------------------------------------
   Varianta demo rulează în localStorage (datele rămân în
   browserul curent). Pentru producție, înlocuiește corpul
   funcțiilor de mai jos cu apeluri către un backend real
   (Firebase Firestore, Supabase sau un API propriu) —
   interfața publică poate rămâne identică.
   ========================================================= */
(function () {
  "use strict";

  var KEY = "csmPadelData";
  var COURTS = [1, 2];
  var SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00",
               "15:00","16:00","17:00","18:00","19:00","20:00","21:00"];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (!d || !Array.isArray(d.bookings) || !Array.isArray(d.blocked)) throw 0;
      return d;
    } catch (e) {
      return { bookings: [], blocked: [] };
    }
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toDateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function newRef() {
    var chars = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
    var s = "";
    for (var i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return "PAD-" + s;
  }

  function normPhone(p) { return (p || "").replace(/[^\d+]/g, "").replace(/^\+40/, "0"); }

  window.PadelStore = {
    COURTS: COURTS,
    SLOTS: SLOTS,
    toDateStr: toDateStr,
    normPhone: normPhone,

    all: function () { return load().bookings.slice(); },
    blockedAll: function () { return load().blocked.slice(); },

    activeBookings: function () {
      var today = toDateStr(new Date());
      return load().bookings.filter(function (b) {
        return b.status === "confirmata" && b.date >= today;
      });
    },

    bookingAt: function (date, slot, court) {
      return load().bookings.find(function (b) {
        return b.status === "confirmata" && b.date === date && b.slot === slot && b.court === court;
      }) || null;
    },

    blockAt: function (date, slot, court) {
      return load().blocked.find(function (x) {
        return x.date === date && x.slot === slot && x.court === court;
      }) || null;
    },

    isFree: function (date, slot, court) {
      return !this.bookingAt(date, slot, court) && !this.blockAt(date, slot, court);
    },

    countActiveForPhone: function (phone) {
      var p = normPhone(phone);
      return this.activeBookings().filter(function (b) { return normPhone(b.telefon) === p; }).length;
    },

    add: function (data) {
      var d = load();
      var booking = {
        id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
        ref: newRef(),
        date: data.date, slot: data.slot, court: data.court,
        nume: data.nume, prenume: data.prenume, telefon: data.telefon,
        status: "confirmata",
        createdAt: new Date().toISOString()
      };
      d.bookings.push(booking);
      save(d);
      return booking;
    },

    cancel: function (id) {
      var d = load();
      var b = d.bookings.find(function (x) { return x.id === id; });
      if (b) { b.status = "anulata"; save(d); }
      return b || null;
    },

    block: function (date, slot, court, motiv) {
      var d = load();
      if (!this.blockAt(date, slot, court)) {
        d.blocked.push({ date: date, slot: slot, court: court, motiv: motiv || "Indisponibil" });
        save(d);
      }
    },

    unblock: function (date, slot, court) {
      var d = load();
      d.blocked = d.blocked.filter(function (x) {
        return !(x.date === date && x.slot === slot && x.court === court);
      });
      save(d);
    },

    exportCsv: function () {
      var rows = [["Ref", "Data", "Ora", "Teren", "Nume", "Prenume", "Telefon", "Status", "Creat la"]];
      load().bookings.forEach(function (b) {
        rows.push([b.ref, b.date, b.slot, "Teren " + b.court, b.nume, b.prenume, b.telefon, b.status, b.createdAt]);
      });
      return rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
      }).join("\r\n");
    }
  };
})();
