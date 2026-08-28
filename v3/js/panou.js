/* Panoul de administrare — publică modificări direct în repository prin
   API-ul GitHub (fiecare „Publică" = un commit; GitHub Pages reface site-ul
   în ~1 minut). Token-ul stă doar în browserul administratorului. */
(function () {
  "use strict";

  var REPO = "calateodor/csm-slatina";
  var RAMURA = "main";
  var PREFIX = "v3/data/";

  /* ================= API GitHub ================= */
  function token() { return localStorage.getItem("panou_token") || ""; }
  function anteturi() {
    return { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" };
  }
  function citeste(fisier) {
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + PREFIX + fisier + "?ref=" + RAMURA,
      { headers: anteturi() }).then(function (r) {
      if (r.status === 404) return { date: null, sha: null };
      if (!r.ok) throw new Error("GitHub " + r.status);
      return r.json().then(function (j) {
        return { date: JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, ""))))), sha: j.sha };
      });
    });
  }
  function scrie(fisier, date, mesaj) {
    // citim intai sha-ul curent, ca sa nu suprascriem orbeste
    return citeste(fisier).then(function (f) {
      var corp = {
        message: "panou: " + mesaj, branch: RAMURA,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(date, null, 2))))
      };
      if (f.sha) corp.sha = f.sha;
      return fetch("https://api.github.com/repos/" + REPO + "/contents/" + PREFIX + fisier, {
        method: "PUT", headers: anteturi(), body: JSON.stringify(corp)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.message || r.status); });
        return r.json();
      });
    });
  }

  /* ================= starea ================= */
  var stiri = null;        // continutul stiri.json
  var echipe = null;       // echipe.json
  var meciuri = null;      // meciuri.json
  var suprascrieri = null; // suprascrieri.json
  var murdare = {};        // ce fisiere au modificari nepublicate
  var sportCurent = "handbal";

  function marcheaza(fisier) {
    murdare[fisier] = true;
    document.getElementById("pn-publica").hidden = false;
    document.getElementById("pn-publica-text").textContent =
      "Modificări nepublicate: " + Object.keys(murdare).join(", ");
  }

  /* ================= poarta ================= */
  var poarta = document.getElementById("pn-poarta");
  var panou = document.getElementById("pn-panou");

  function intra() {
    fetch("https://api.github.com/repos/" + REPO, { headers: anteturi() })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 ? "Token invalid sau expirat." : "GitHub " + r.status);
        poarta.hidden = true; panou.hidden = false;
        incarcaTot();
      })
      .catch(function (e) {
        document.getElementById("pn-poarta-eroare").textContent = e.message;
        poarta.hidden = false;
      });
  }
  document.getElementById("pn-intra").addEventListener("click", function () {
    var t = document.getElementById("pn-token").value.trim();
    if (!t) return;
    localStorage.setItem("panou_token", t);
    document.getElementById("pn-poarta-eroare").textContent = "";
    intra();
  });
  document.getElementById("pn-iesire").addEventListener("click", function () {
    localStorage.removeItem("panou_token");
    localStorage.setItem("panou_editare", "0");
    location.reload();
  });
  if (token()) { intra(); } else { poarta.hidden = false; }

  /* ================= incarcare ================= */
  function incarcaTot() {
    Promise.all([citeste("stiri.json"), citeste("echipe.json"),
                 citeste("meciuri.json"), citeste("suprascrieri.json")])
      .then(function (r) {
        stiri = r[0].date || { categorii: {}, stiri: [] };
        echipe = r[1].date;
        meciuri = r[2].date || { meciuri: [] };
        suprascrieri = r[3].date || { meciuri: {}, lot: {} };
        deseneazaStiri(); deseneazaLot(); deseneazaMeciuri();
      })
      .catch(function (e) { alert("Nu am putut încărca datele: " + e.message); });
  }

  /* ================= navigarea intre taburi ================= */
  document.querySelectorAll(".pn-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".pn-tab").forEach(function (x) { x.classList.remove("activ"); });
      t.classList.add("activ");
      ["stiri", "lot", "meciuri", "editare"].forEach(function (nume) {
        document.getElementById("tab-" + nume).hidden = nume !== t.dataset.tab;
      });
    });
  });

  /* ================= editorul generic ================= */
  var editor = document.getElementById("pn-editor");
  function deschideEditor(titlu, campuri, valori, laSalvare) {
    var h = '<div class="pn-cutie"><h3>' + titlu + "</h3>";
    campuri.forEach(function (c) {
      var v = valori[c.cheie];
      v = v == null ? "" : v;
      h += "<label" + (c.rand ? ' class="pn-rand-2-wrap"' : "") + ">" + c.nume;
      if (c.tip === "textarea") {
        h += '<textarea data-c="' + c.cheie + '" rows="' + (c.randuri || 6) + '">' +
             String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</textarea>";
      } else if (c.tip === "select") {
        h += '<select data-c="' + c.cheie + '">' + c.optiuni.map(function (o) {
          return '<option value="' + o[0] + '"' + (String(v) === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select>";
      } else if (c.tip === "check") {
        h = h.replace(/<label[^>]*>[^<]*$/, '<label class="pn-check">');
        h += '<input type="checkbox" data-c="' + c.cheie + '"' + (v ? " checked" : "") + "> " + c.nume;
      } else {
        h += '<input type="' + (c.tip || "text") + '" data-c="' + c.cheie + '" value="' +
             String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">';
      }
      h += "</label>";
    });
    h += '<div class="pn-butoane"><button class="pn-btn" id="ed-renunta" type="button">Renunță</button>' +
         '<button class="pn-btn pn-btn-plin" id="ed-ok" type="button">Gata</button></div></div>';
    editor.innerHTML = h; editor.hidden = false;
    document.getElementById("ed-renunta").addEventListener("click", function () { editor.hidden = true; });
    document.getElementById("ed-ok").addEventListener("click", function () {
      var out = {};
      editor.querySelectorAll("[data-c]").forEach(function (el) {
        out[el.dataset.c] = el.type === "checkbox" ? el.checked : el.value;
      });
      editor.hidden = true;
      laSalvare(out);
    });
  }

  /* ================= STIRI ================= */
  function slugDin(t) {
    return t.toLowerCase()
      .replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[șş]/g, "s").replace(/[țţ]/g, "t")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  var CAMPURI_STIRE = function () {
    return [
      { cheie: "titlu", nume: "Titlu" },
      { cheie: "categorie", nume: "Categorie", tip: "select",
        optiuni: Object.keys(stiri.categorii).map(function (c) { return [c, stiri.categorii[c]]; }) },
      { cheie: "data", nume: "Data", tip: "date" },
      { cheie: "rezumat", nume: "Rezumat (o frază, apare pe card)" },
      { cheie: "corpText", nume: "Conținutul articolului (paragrafe separate prin linie goală)",
        tip: "textarea", randuri: 10 },
      { cheie: "poza", nume: "Poza (adresa imaginii — opțional)" },
      { cheie: "publicat", nume: "Publicat pe site", tip: "check" }
    ];
  };
  function deseneazaStiri() {
    var lista = document.getElementById("stiri-lista");
    lista.innerHTML = stiri.stiri.map(function (s, i) {
      return '<div class="pn-rand"><div class="pn-info"><strong>' + s.titlu + "</strong>" +
        "<span>" + (stiri.categorii[s.categorie] || s.categorie) + " · " + s.data + "</span></div>" +
        '<span class="pn-etic ' + (s.publicat !== false ? "publicat\">Publicat" : "ciorna\">Ciornă") + "</span>" +
        '<button class="pn-btn pn-btn-mic" data-ed="' + i + '" type="button">Editează</button>' +
        '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-st="' + i + '" type="button">Șterge</button></div>';
    }).join("") || '<p class="pn-nota">Nicio știre încă.</p>';
    lista.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaStirea(parseInt(b.dataset.ed, 10)); });
    });
    lista.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Ștergi articolul „" + stiri.stiri[b.dataset.st].titlu + "”?")) return;
        stiri.stiri.splice(parseInt(b.dataset.st, 10), 1);
        marcheaza("stiri.json"); deseneazaStiri();
      });
    });
  }
  function editeazaStirea(idx) {
    var e = idx === -1
      ? { titlu: "", categorie: "stiri-club", data: new Date().toISOString().slice(0, 10),
          rezumat: "", corp: [], poza: "", publicat: true }
      : stiri.stiri[idx];
    var valori = Object.assign({}, e, { corpText: (e.corp || []).join("\n\n") });
    deschideEditor(idx === -1 ? "Știre nouă" : "Editează știrea", CAMPURI_STIRE(), valori, function (out) {
      var noua = {
        slug: e.slug || slugDin(out.titlu),
        categorie: out.categorie, data: out.data, titlu: out.titlu,
        rezumat: out.rezumat, poza: out.poza || null, publicat: !!out.publicat,
        corp: out.corpText.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      };
      if (idx === -1) stiri.stiri.unshift(noua); else stiri.stiri[idx] = noua;
      marcheaza("stiri.json"); deseneazaStiri();
    });
  }
  document.getElementById("stire-noua").addEventListener("click", function () { editeazaStirea(-1); });

  /* ================= LOT ================= */
  document.querySelectorAll("#lot-sport button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#lot-sport button").forEach(function (x) { x.classList.remove("activ"); });
      b.classList.add("activ");
      sportCurent = b.dataset.sport;
      deseneazaLot();
    });
  });
  var CAMPURI_JUCATOR = [
    { cheie: "numar", nume: "Număr", tip: "number" },
    { cheie: "nume", nume: "Nume complet" },
    { cheie: "post", nume: "Post" },
    { cheie: "nat", nume: "Naționalitate" },
    { cheie: "poza", nume: "Poza (ex. assets/img/lot/handbal/16-nagy.jpg — opțional)" }
  ];
  function deseneazaLot() {
    if (!echipe) return;
    var lot = (echipe[sportCurent] || {}).lot || [];
    var manual = suprascrieri.lot && suprascrieri.lot[sportCurent];
    document.getElementById("lot-nota").innerHTML = manual
      ? 'Lotul de <b>' + sportCurent + '</b> e pe <b>manual</b> — scriptul de actualizare nu-l rescrie. ' +
        '<button class="pn-btn pn-btn-mic" id="lot-auto" type="button">Înapoi pe automat</button>'
      : 'Lotul de <b>' + sportCurent + '</b> e pe <b>automat</b> — prima editare îl trece pe manual, ca modificările tale să nu fie șterse la actualizare.';
    var lista = document.getElementById("lot-lista");
    lista.innerHTML = lot.map(function (j, i) {
      return '<div class="pn-rand"><div class="pn-info"><strong>#' + (j.numar != null ? j.numar : "—") +
        " " + j.nume + "</strong><span>" + (j.post || "post nesetat") +
        (j.poza ? " · are portret" : " · siluetă") + "</span></div>" +
        '<button class="pn-btn pn-btn-mic" data-ed="' + i + '" type="button">Editează</button>' +
        '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-st="' + i + '" type="button">Scoate</button></div>';
    }).join("") || '<p class="pn-nota">Lot gol.</p>';
    var lotAuto = document.getElementById("lot-auto");
    if (lotAuto) lotAuto.addEventListener("click", function () {
      delete suprascrieri.lot[sportCurent];
      marcheaza("suprascrieri.json"); deseneazaLot();
    });
    lista.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaJucator(parseInt(b.dataset.ed, 10)); });
    });
    lista.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        var j = lot[parseInt(b.dataset.st, 10)];
        if (!confirm("Îl scoți din lot pe " + j.nume + "?")) return;
        lot.splice(parseInt(b.dataset.st, 10), 1);
        lotPeManual(); deseneazaLot();
      });
    });
  }
  function lotPeManual() {
    suprascrieri.lot = suprascrieri.lot || {};
    suprascrieri.lot[sportCurent] = true;
    marcheaza("echipe.json"); marcheaza("suprascrieri.json");
  }
  function editeazaJucator(idx) {
    var lot = echipe[sportCurent].lot;
    var j = idx === -1 ? { numar: "", nume: "", post: "", nat: "România", poza: "" } : lot[idx];
    deschideEditor(idx === -1 ? "Jucător nou" : "Editează jucătorul", CAMPURI_JUCATOR, j, function (out) {
      var nou = Object.assign({}, j, {
        numar: out.numar === "" ? null : parseInt(out.numar, 10),
        nume: out.nume, post: out.post, nat: out.nat
      });
      if (out.poza) nou.poza = out.poza; else delete nou.poza;
      if (idx === -1) lot.push(nou); else lot[idx] = nou;
      lotPeManual(); deseneazaLot();
    });
  }
  document.getElementById("lot-adauga").addEventListener("click", function () { editeazaJucator(-1); });

  /* ================= MECIURI ================= */
  function idMeci(m, i) { return m.flashscoreId || "manual-" + i; }
  var CAMPURI_MECI = [
    { cheie: "sport", nume: "Sport", tip: "select", optiuni: [["Fotbal", "Fotbal"], ["Handbal", "Handbal"]] },
    { cheie: "competitie", nume: "Competiție" },
    { cheie: "gazde", nume: "Gazde" },
    { cheie: "oaspeti", nume: "Oaspeți" },
    { cheie: "cand", nume: "Data și ora", tip: "datetime-local" }
  ];
  function candDin(ts) {
    var d = new Date(ts * 1000);
    function z(n) { return ("0" + n).slice(-2); }
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) +
           "T" + z(d.getHours()) + ":" + z(d.getMinutes());
  }
  function deseneazaMeciuri() {
    var lista = document.getElementById("meciuri-lista");
    lista.innerHTML = meciuri.meciuri.map(function (m, i) {
      var manual = suprascrieri.meciuri && suprascrieri.meciuri[idMeci(m, i)];
      return '<div class="pn-rand"><div class="pn-info"><strong>' + m.gazde + " – " + m.oaspeti + "</strong>" +
        "<span>" + m.sport + " · " + m.competitie + " · " + candDin(m.timestamp).replace("T", " ") + "</span></div>" +
        '<span class="pn-etic ' + (manual ? "manual\">Manual" : "auto\">Automat") + "</span>" +
        (manual ? '<button class="pn-btn pn-btn-mic" data-auto="' + i + '" type="button">Înapoi pe automat</button>' : "") +
        '<button class="pn-btn pn-btn-mic" data-ed="' + i + '" type="button">Editează</button>' +
        '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-st="' + i + '" type="button">Șterge</button></div>';
    }).join("") || '<p class="pn-nota">Niciun meci în listă.</p>';
    lista.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaMeci(parseInt(b.dataset.ed, 10)); });
    });
    lista.querySelectorAll("[data-auto]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.dataset.auto, 10);
        delete suprascrieri.meciuri[idMeci(meciuri.meciuri[i], i)];
        marcheaza("suprascrieri.json"); deseneazaMeciuri();
      });
    });
    lista.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.dataset.st, 10);
        if (!confirm("Ștergi meciul " + meciuri.meciuri[i].gazde + " – " + meciuri.meciuri[i].oaspeti + "?")) return;
        suprascrieri.meciuri = suprascrieri.meciuri || {};
        suprascrieri.meciuri[idMeci(meciuri.meciuri[i], i)] = "sters";
        meciuri.meciuri.splice(i, 1);
        marcheaza("meciuri.json"); marcheaza("suprascrieri.json"); deseneazaMeciuri();
      });
    });
  }
  function editeazaMeci(idx) {
    var m = idx === -1
      ? { sport: "Handbal", competitie: "", gazde: "", oaspeti: "", timestamp: Math.floor(Date.now() / 1000) }
      : meciuri.meciuri[idx];
    var valori = Object.assign({}, m, { cand: candDin(m.timestamp) });
    deschideEditor(idx === -1 ? "Meci nou" : "Editează meciul", CAMPURI_MECI, valori, function (out) {
      var nou = Object.assign({}, m, {
        sport: out.sport, competitie: out.competitie,
        gazde: out.gazde, oaspeti: out.oaspeti,
        timestamp: Math.floor(new Date(out.cand).getTime() / 1000)
      });
      if (idx === -1) { meciuri.meciuri.push(nou); idx = meciuri.meciuri.length - 1; }
      else meciuri.meciuri[idx] = nou;
      meciuri.meciuri.sort(function (a, b) { return a.timestamp - b.timestamp; });
      suprascrieri.meciuri = suprascrieri.meciuri || {};
      suprascrieri.meciuri[idMeci(nou, idx)] = nou;
      marcheaza("meciuri.json"); marcheaza("suprascrieri.json"); deseneazaMeciuri();
    });
  }
  document.getElementById("meci-adauga").addEventListener("click", function () { editeazaMeci(-1); });

  /* ================= EDITARE IN PAGINA ================= */
  function stareEditare() {
    var pornit = localStorage.getItem("panou_editare") === "1";
    document.getElementById("editare-porneste").textContent =
      pornit ? "Oprește modul editare" : "Pornește modul editare";
    document.getElementById("editare-stare").textContent =
      pornit ? "Modul editare e PORNIT — deschide o pagină din lista de mai jos." : "";
  }
  document.getElementById("editare-porneste").addEventListener("click", function () {
    var pornit = localStorage.getItem("panou_editare") === "1";
    localStorage.setItem("panou_editare", pornit ? "0" : "1");
    stareEditare();
  });
  stareEditare();

  /* ================= PUBLICAREA ================= */
  document.getElementById("pn-publica-buton").addEventListener("click", function () {
    var b = this;
    b.disabled = true; b.textContent = "Se publică…";
    var pasi = [];
    if (murdare["stiri.json"]) pasi.push(["stiri.json", stiri, "știri actualizate"]);
    if (murdare["echipe.json"]) pasi.push(["echipe.json", echipe, "lot " + sportCurent + " actualizat"]);
    if (murdare["meciuri.json"]) pasi.push(["meciuri.json", meciuri, "meciuri actualizate"]);
    if (murdare["suprascrieri.json"]) pasi.push(["suprascrieri.json", suprascrieri, "suprascrieri actualizate"]);
    (function urmatorul() {
      if (!pasi.length) {
        murdare = {};
        document.getElementById("pn-publica").hidden = true;
        b.disabled = false; b.textContent = "Publică pe site";
        alert("Publicat! Site-ul viu se actualizează în ~1 minut.");
        return;
      }
      var p = pasi.shift();
      scrie(p[0], p[1], p[2]).then(urmatorul).catch(function (e) {
        b.disabled = false; b.textContent = "Publică pe site";
        alert("Eroare la " + p[0] + ": " + e.message);
      });
    })();
  });
})();
