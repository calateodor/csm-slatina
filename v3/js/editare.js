/* Editarea în pagină — jumătatea „client" a panoului de administrare.
   1) Hidratare: data/continut.json ține textele suprascrise din panou;
      la încărcare, orice element cu data-edit="cheie" primește varianta
      salvată acolo (dacă există). Fără login, asta e tot ce face scriptul.
   2) Mod editare: dacă browserul are token-ul de panou salvat și modul
      activat (din panou.html), fiecare element etichetat primește un
      creion; editarea salvează direct în repository prin API-ul GitHub,
      iar site-ul viu se actualizează la următoarea publicare Pages. */
(function () {
  "use strict";

  var REPO = "calateodor/csm-slatina";
  var RAMURA = "main";
  var CALE_CONTINUT = "v3/data/continut.json";

  // radacina site-ului (paginile din sectii/ stau un nivel mai jos)
  var RAD = /\/sectii\//.test(location.pathname) ? "../" : "";

  var continut = {};

  /* ---------- API GitHub (comun cu panou.js, dar de sine statator) ---------- */
  function token() { return localStorage.getItem("panou_token") || ""; }
  function apiCitesteFisier(cale) {
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + cale + "?ref=" + RAMURA, {
      headers: { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" }
    }).then(function (r) {
      if (r.status === 404) return { continut: null, sha: null };
      if (!r.ok) throw new Error("GitHub: " + r.status);
      return r.json().then(function (j) {
        var text = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ""))));
        return { continut: text, sha: j.sha };
      });
    });
  }
  function apiScrieFisier(cale, text, mesaj, sha) {
    var corp = {
      message: mesaj, branch: RAMURA,
      content: btoa(unescape(encodeURIComponent(text)))
    };
    if (sha) corp.sha = sha;
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + cale, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" },
      body: JSON.stringify(corp)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.message || r.status); });
      return r.json();
    });
  }

  /* ---------- 1. hidratarea textelor suprascrise ---------- */
  function aplicaContinut() {
    Object.keys(continut).forEach(function (cheie) {
      var el = document.querySelector('[data-edit="' + cheie + '"]');
      if (el) el.innerHTML = continut[cheie];
    });
  }
  fetch(RAD + "data/continut.json?v=" + Date.now())
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (j) { continut = j || {}; aplicaContinut(); porneste(); })
    .catch(function () { porneste(); });

  /* ---------- 2. modul de editare ---------- */
  function porneste() {
    if (!token() || localStorage.getItem("panou_editare") !== "1") return;

    var stil = document.createElement("style");
    stil.textContent =
      "[data-edit]{outline:1.5px dashed rgba(246,200,28,.55); outline-offset:3px; position:relative}" +
      ".edit-creion{position:absolute; top:-14px; right:-14px; z-index:60; width:30px; height:30px;" +
      " border-radius:50%; border:0; cursor:pointer; background:#f6c81c; color:#14345c;" +
      " font-size:14px; line-height:1; box-shadow:0 4px 12px rgba(0,0,0,.3)}" +
      ".edit-bara{position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:99;" +
      " display:flex; gap:10px; align-items:center; background:#14345c; color:#fff;" +
      " border:1px solid rgba(246,200,28,.5); border-radius:999px; padding:10px 18px;" +
      " font:600 13px/1 Manrope,sans-serif; box-shadow:0 10px 30px rgba(0,0,0,.35)}" +
      ".edit-bara button{border:0; cursor:pointer; border-radius:999px; padding:7px 14px;" +
      " font:700 12px/1 Manrope,sans-serif; background:#f6c81c; color:#14345c}" +
      ".edit-modal{position:fixed; inset:0; z-index:100; display:grid; place-items:center;" +
      " background:rgba(10,20,40,.6)}" +
      ".edit-modal .cutie{width:min(680px,92vw); background:#fff; border-radius:16px; padding:22px}" +
      ".edit-modal h3{font:700 15px/1.3 Poppins,sans-serif; color:#14345c; margin-bottom:12px}" +
      ".edit-modal textarea{width:100%; min-height:160px; font:14px/1.5 monospace;" +
      " border:1px solid #ccd; border-radius:10px; padding:12px}" +
      ".edit-modal .butoane{display:flex; gap:10px; justify-content:flex-end; margin-top:14px}" +
      ".edit-modal .butoane button{border:0; cursor:pointer; border-radius:10px; padding:10px 18px;" +
      " font:700 13px/1 Manrope,sans-serif}" +
      ".edit-salveaza{background:#14345c; color:#fff} .edit-renunta{background:#e8ecf3; color:#14345c}";
    document.head.appendChild(stil);

    var bara = document.createElement("div");
    bara.className = "edit-bara";
    bara.innerHTML = "<span>✏️ Mod editare — apasă creionul de pe orice element marcat</span>" +
      '<button type="button" id="edit-iesi">Ieși din editare</button>';
    document.body.appendChild(bara);
    document.getElementById("edit-iesi").addEventListener("click", function () {
      localStorage.setItem("panou_editare", "0");
      location.reload();
    });

    document.querySelectorAll("[data-edit]").forEach(function (el) {
      var b = document.createElement("button");
      b.className = "edit-creion"; b.type = "button"; b.textContent = "✏️";
      b.title = "Editează: " + el.getAttribute("data-edit");
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        deschideEditor(el);
      });
      el.appendChild(b);
    });

    function deschideEditor(el) {
      var cheie = el.getAttribute("data-edit");
      var modal = document.createElement("div");
      modal.className = "edit-modal";
      var curat = el.cloneNode(true);
      var creion = curat.querySelector(".edit-creion");
      if (creion) creion.remove();
      modal.innerHTML = '<div class="cutie"><h3>' + cheie + "</h3>" +
        "<textarea></textarea>" +
        '<div class="butoane"><button type="button" class="edit-renunta">Renunță</button>' +
        '<button type="button" class="edit-salveaza">Salvează pe site</button></div></div>';
      modal.querySelector("textarea").value = curat.innerHTML.trim();
      document.body.appendChild(modal);
      modal.querySelector(".edit-renunta").addEventListener("click", function () { modal.remove(); });
      modal.querySelector(".edit-salveaza").addEventListener("click", function () {
        var buton = modal.querySelector(".edit-salveaza");
        buton.textContent = "Se salvează…"; buton.disabled = true;
        var valoare = modal.querySelector("textarea").value;
        apiCitesteFisier(CALE_CONTINUT).then(function (f) {
          var j = f.continut ? JSON.parse(f.continut) : {};
          j[cheie] = valoare;
          return apiScrieFisier(CALE_CONTINUT, JSON.stringify(j, null, 2),
                                "panou: text editat (" + cheie + ")", f.sha);
        }).then(function () {
          continut[cheie] = valoare;
          var creionVechi = el.querySelector(".edit-creion");
          el.innerHTML = valoare;
          if (creionVechi) el.appendChild(creionVechi);
          modal.remove();
        }).catch(function (e) {
          buton.textContent = "Eroare: " + e.message; buton.disabled = false;
        });
      });
    }
  }
})();
