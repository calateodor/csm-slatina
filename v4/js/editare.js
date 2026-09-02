/* Editarea în pagină — jumătatea „client" a panoului de administrare.

   Pentru vizitatori: aplică suprascrierile din data/continut.json —
   texte (data-edit), poze (orice <img>), fundaluri speciale
   (data-edit-fundal: fundaluri CSS și clipul video al piscinei).

   Pentru administrator (token salvat + Mod Editare pornit din panou):
   - creion pe fiecare text marcat;
   - creion pe fiecare fotografie: încarci un fișier de pe calculator
     (optimizat și publicat în repository) sau lipești un link;
   - pe paginile cu lot: creion pe cardul deschis din evantai + butonul
     plutitor „Lotul" cu lista completă, adăugare și scoatere.
   Fiecare salvare = un commit pe ramura aleasă în bara plutitoare
   (Test -> csmslatina.ro/test/, Live -> site-ul public). */
(function () {
  "use strict";

  var REPO = "calateodor/csm-slatina";
  /* Editările din pagină se salvează imediat (un commit fiecare), deci nu au
     un „publică” separat: ținta lor e comutatorul Test | Live din bara
     plutitoare. Aceeași alegere (localStorage.panou_ramura) o folosește și
     panoul, ca cele două să nu se contrazică. */
  var RAMURI = { test: "test", live: "main" };
  var LIVE_ACTIV = false;   // devine true la trecerea site-ului pe csmslatina.ro
  var LINK_TEST = "https://www.csmslatina.ro/test/";
  function tinta() { return localStorage.getItem("panou_ramura") === "test" ? "test" : "live"; }
  function ramura() { return RAMURI[tinta()]; }
  var RAD = /\/sectii\//.test(location.pathname) ? "../" : "";
  /* versiunea se citeste din adresa (v3, v4, ...), ca sa nu mai fie nevoie
     de editat fisierul cand se face o versiune noua a site-ului */
  var VERSIUNE = (location.pathname.match(/\/(v\d+)\//) || [null, "v4"])[1];

  function paginaCheie() {
    var p = location.pathname;
    var i = p.indexOf("/" + VERSIUNE + "/");
    p = i !== -1 ? p.slice(i + VERSIUNE.length + 2) : p.split("/").pop();
    return p || "index.html";
  }
  var PAGINA = paginaCheie();

  /* ================= API GitHub ================= */
  function token() { return localStorage.getItem("panou_token") || ""; }
  function anteturi() {
    return { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" };
  }
  function apiCiteste(cale) {
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + cale + "?ref=" + ramura(),
      { headers: anteturi() }).then(function (r) {
      if (r.status === 404) return { text: null, sha: null };
      if (!r.ok) throw new Error("GitHub " + r.status);
      return r.json().then(function (j) {
        return { text: decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))), sha: j.sha };
      });
    });
  }
  function apiScrie(cale, continutB64, mesaj, sha) {
    var corp = { message: "panou: " + mesaj, branch: ramura(), content: continutB64 };
    if (sha) corp.sha = sha;
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + cale, {
      method: "PUT", headers: anteturi(), body: JSON.stringify(corp)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.message || r.status); });
      return r.json();
    });
  }
  function b64text(text) { return btoa(unescape(encodeURIComponent(text))); }
  function salveazaJson(fisier, modifica, mesaj) {
    // citire -> modificare -> scriere, ca sa nu pierdem editari paralele
    return apiCiteste(VERSIUNE + "/data/" + fisier).then(function (f) {
      var j = f.text ? JSON.parse(f.text) : {};
      j = modifica(j) || j;
      return apiScrie(VERSIUNE + "/data/" + fisier, b64text(JSON.stringify(j, null, 2)), mesaj, f.sha)
        .then(function () { return j; });
    });
  }

  /* ================= starea continutului ================= */
  var continut = { texte: {}, img: {}, fundal: {} };

  function normalizeazaSrc(src) {
    return (src || "").replace(/^(\.\.\/)+/, "");
  }
  function cheieImg(el) {
    var orig = el.getAttribute("data-edit-orig") || normalizeazaSrc(el.getAttribute("src"));
    // siglele din antet/subsol sunt aceleasi peste tot: cheie globala
    var global = el.closest("header, footer, .menu-overlay");
    return (global ? "*" : PAGINA) + "|" + orig;
  }
  function srcAplicabil(valoare) {
    return /^https?:/.test(valoare) ? valoare : RAD + valoare;
  }

  /* ================= aplicarea suprascrierilor ================= */
  function aplicaTexte() {
    Object.keys(continut.texte).forEach(function (cheie) {
      document.querySelectorAll('[data-edit="' + cheie + '"]').forEach(function (el) {
        el.innerHTML = continut.texte[cheie];
      });
    });
  }
  function aplicaImg(el) {
    var orig = normalizeazaSrc(el.getAttribute("src"));
    var val = continut.img[PAGINA + "|" + orig] || continut.img["*|" + orig];
    if (!val) return;
    el.setAttribute("data-edit-orig", orig);
    // intr-un <picture>, sursele alternative ar bate src-ul nou
    var picture = el.closest("picture");
    if (picture) picture.querySelectorAll("source").forEach(function (s) { s.remove(); });
    el.removeAttribute("srcset");
    el.src = srcAplicabil(val);
  }
  function aplicaFundal(el) {
    var cheie = el.getAttribute("data-edit-fundal");
    var val = continut.fundal[cheie];
    if (!val) return;
    aplicaFundalValoare(el, val);
  }
  function aplicaFundalValoare(el, src) {
    var tip = el.getAttribute("data-fundal-tip") || "";
    var gradient = el.getAttribute("data-fundal-val") || "";
    var url = "url('" + srcAplicabil(src) + "') center / cover no-repeat #0c1c3a";
    if (el.tagName === "VIDEO") {
      var sursa = el.querySelector("source");
      if (sursa) { sursa.src = srcAplicabil(src); el.load(); el.play && el.play().catch(function () {}); }
    } else if (tip.indexOf("var:") === 0) {
      document.documentElement.style.setProperty(tip.slice(4),
        (gradient ? gradient + ", " : "") + url);
    } else {
      el.style.background = (gradient ? gradient + ", " : "") + url;
    }
  }
  function aplicaTot() {
    aplicaTexte();
    document.querySelectorAll("img").forEach(aplicaImg);
    document.querySelectorAll("[data-edit-fundal]").forEach(aplicaFundal);
  }

  fetch(RAD + "data/continut.json?v=" + Date.now())
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (j) {
      j = j || {};
      // formatul vechi era plat (doar texte)
      continut = j.texte || j.img || j.fundal
        ? { texte: j.texte || {}, img: j.img || {}, fundal: j.fundal || {} }
        : { texte: j, img: {}, fundal: {} };
      aplicaTot();
      porneste();
    })
    .catch(function () { porneste(); });

  /* =========================================================
     MODUL DE EDITARE
     ========================================================= */
  function porneste() {
    if (!token() || localStorage.getItem("panou_editare") !== "1") return;

    injecteazaStil();
    bara();
    creioaneTexte();
    creioaneImagini();
    creioaneFundaluri();
    modulLot();
    window.addEventListener("resize", aseazaCreioanePlutitoare);
  }

  function injecteazaStil() {
    var stil = document.createElement("style");
    stil.textContent =
      "[data-edit]{outline:1.5px dashed rgba(246,200,28,.5); outline-offset:3px; position:relative}" +
      ".edit-creion{position:absolute; z-index:80; width:30px; height:30px; border-radius:50%;" +
      " border:0; cursor:pointer; background:#f6c81c; color:#14345c; font-size:14px; line-height:1;" +
      " box-shadow:0 4px 12px rgba(0,0,0,.35); display:grid; place-items:center; padding:0}" +
      ".edit-creion.text{top:-14px; right:-14px}" +
      ".edit-creion.plutitor{position:absolute}" +
      ".edit-bara{position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:95;" +
      " display:flex; gap:10px; align-items:center; background:#14345c; color:#fff;" +
      " border:1px solid rgba(246,200,28,.5); border-radius:999px; padding:10px 18px;" +
      " font:600 13px/1.3 Manrope,sans-serif; box-shadow:0 10px 30px rgba(0,0,0,.35); flex-wrap:wrap}" +
      ".edit-bara button{border:0; cursor:pointer; border-radius:999px; padding:8px 14px;" +
      " font:700 12px/1 Manrope,sans-serif; background:#f6c81c; color:#14345c}" +
      ".edit-bara .gri{background:rgba(255,255,255,.15); color:#fff}" +
      ".edit-tinta{display:inline-flex; align-items:center; gap:4px; padding:3px 3px 3px 10px;" +
      " border-radius:999px; background:rgba(255,255,255,.08)}" +
      ".edit-tinta em{font:700 10px/1 Manrope,sans-serif; letter-spacing:.08em; text-transform:uppercase;" +
      " font-style:normal; color:rgba(255,255,255,.7); margin-right:4px}" +
      ".edit-bara .edit-tinta-btn{background:transparent; color:#fff; padding:7px 12px}" +
      ".edit-bara .edit-tinta-btn.activ{background:#2ec27e; color:#06261a}" +
      ".edit-bara .edit-tinta-btn[disabled]{opacity:.4; cursor:not-allowed}" +
      ".edit-bara .edit-link{color:#f6c81c; font:700 12px/1 Manrope,sans-serif; text-decoration:underline}" +
      ".edit-modal{position:fixed; inset:0; z-index:110; display:grid; place-items:center;" +
      " background:rgba(10,20,40,.65); padding:16px; overflow:auto}" +
      ".edit-modal .cutie{width:min(700px,94vw); max-height:92vh; overflow:auto; background:#fff;" +
      " border-radius:16px; padding:22px; font-family:Manrope,sans-serif; color:#14345c}" +
      ".edit-modal h3{font:700 15px/1.3 Poppins,sans-serif; margin-bottom:12px; word-break:break-all}" +
      ".edit-modal textarea{width:100%; min-height:150px; font:13px/1.5 monospace;" +
      " border:1px solid #ccd; border-radius:10px; padding:12px}" +
      ".edit-modal input[type=text], .edit-modal input[type=number]{width:100%; font:14px/1.4" +
      " Manrope,sans-serif; border:1px solid #ccd; border-radius:10px; padding:10px 12px; margin-top:4px}" +
      ".edit-modal label{display:block; margin:10px 0 0; font:700 11px/1.4 Manrope,sans-serif;" +
      " letter-spacing:.08em; text-transform:uppercase; color:#47617f}" +
      ".edit-modal .butoane{display:flex; gap:10px; justify-content:flex-end; margin-top:16px; flex-wrap:wrap}" +
      ".edit-modal .butoane button{border:0; cursor:pointer; border-radius:10px; padding:10px 18px;" +
      " font:700 13px/1 Manrope,sans-serif}" +
      ".edit-salveaza{background:#14345c; color:#fff} .edit-renunta{background:#e8ecf3; color:#14345c}" +
      ".edit-sterge{background:#fbe4e4; color:#c02626; margin-right:auto}" +
      ".edit-poza-prev{width:100%; max-height:260px; object-fit:contain; background:#eef2f8;" +
      " border-radius:10px; margin:10px 0}" +
      ".edit-cai{display:grid; gap:8px; grid-template-columns:1fr 1fr}" +
      ".edit-cale{border:1.5px dashed #b9c4d6; border-radius:10px; padding:14px; text-align:center;" +
      " cursor:pointer; font:600 13px/1.4 Manrope,sans-serif; color:#47617f; background:#f8fafd}" +
      ".edit-cale:hover{border-color:#14345c; color:#14345c}" +
      ".edit-lista{display:grid; gap:8px; margin-top:8px}" +
      ".edit-rand{display:flex; gap:10px; align-items:center; border:1px solid #e3e9f2;" +
      " border-radius:10px; padding:10px 12px; font:600 13px/1.3 Manrope,sans-serif}" +
      ".edit-rand span{flex:1}" +
      ".edit-rand button{border:0; cursor:pointer; border-radius:8px; padding:7px 10px;" +
      " font:700 11px/1 Manrope,sans-serif; background:#e8ecf3; color:#14345c}" +
      ".edit-rand .rosu{background:#fbe4e4; color:#c02626}" +
      "@media (max-width:640px){.edit-cai{grid-template-columns:1fr}}";
    document.head.appendChild(stil);
  }

  function bara() {
    var b = document.createElement("div");
    b.className = "edit-bara";
    b.innerHTML = "<span>✏️ Mod editare — texte, poze" +
      (document.getElementById("lot-app") ? ", lot" : "") + "</span>" +
      '<span class="edit-tinta" title="Unde se salvează editările din pagină">' +
        "<em>Salvez pe</em>" +
        '<button type="button" class="edit-tinta-btn" data-tinta="test">Test</button>' +
        '<button type="button" class="edit-tinta-btn" data-tinta="live">Live</button>' +
      "</span>" +
      '<a class="edit-link" href="' + LINK_TEST + '" target="_blank" rel="noopener">vezi testul ↗</a>' +
      '<button type="button" id="edit-iesi" class="gri">Ieși din editare</button>';
    document.body.appendChild(b);
    document.getElementById("edit-iesi").addEventListener("click", function () {
      localStorage.setItem("panou_editare", "0");
      location.reload();
    });
    function arataTinta() {
      b.querySelectorAll(".edit-tinta-btn").forEach(function (x) {
        x.classList.toggle("activ", x.dataset.tinta === tinta());
        if (x.dataset.tinta === "live") {
          x.disabled = !LIVE_ACTIV;
          x.title = LIVE_ACTIV ? "" : "Se activează la trecerea site-ului pe csmslatina.ro";
        }
      });
    }
    b.querySelectorAll(".edit-tinta-btn").forEach(function (x) {
      x.addEventListener("click", function () {
        if (x.disabled) return;
        localStorage.setItem("panou_ramura", x.dataset.tinta);
        arataTinta();
      });
    });
    arataTinta();
  }

  /* ================= modalul generic ================= */
  function modal(html) {
    var m = document.createElement("div");
    m.className = "edit-modal";
    m.innerHTML = '<div class="cutie">' + html + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
    return m;
  }

  /* ================= textele ================= */
  function creioaneTexte() {
    document.querySelectorAll("[data-edit]").forEach(function (el) {
      var b = document.createElement("button");
      b.className = "edit-creion text"; b.type = "button"; b.textContent = "✏️";
      b.title = "Editează textul";
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        editeazaText(el);
      });
      el.appendChild(b);
    });
  }
  function editeazaText(el) {
    var cheie = el.getAttribute("data-edit");
    var curat = el.cloneNode(true);
    curat.querySelectorAll(".edit-creion").forEach(function (c) { c.remove(); });
    var m = modal("<h3>Text: " + cheie + "</h3><textarea></textarea>" +
      '<div class="butoane"><button class="edit-renunta" type="button">Renunță</button>' +
      '<button class="edit-salveaza" type="button">Salvează pe site</button></div>');
    m.querySelector("textarea").value = curat.innerHTML.trim();
    m.querySelector(".edit-renunta").addEventListener("click", function () { m.remove(); });
    m.querySelector(".edit-salveaza").addEventListener("click", function () {
      ocupat(m, true);
      var val = m.querySelector("textarea").value;
      salveazaJson("continut.json", function (j) {
        j = formatNou(j); j.texte[cheie] = val; return j;
      }, "text editat (" + cheie + ")").then(function () {
        continut.texte[cheie] = val;
        var creion = el.querySelector(".edit-creion");
        el.innerHTML = val;
        if (creion) el.appendChild(creion);
        m.remove();
      }).catch(function (e) { ocupat(m, false, e); });
    });
  }
  function formatNou(j) {
    if (!j.texte && !j.img && !j.fundal) j = { texte: j || {}, img: {}, fundal: {} };
    j.texte = j.texte || {}; j.img = j.img || {}; j.fundal = j.fundal || {};
    return j;
  }
  function ocupat(m, da, eroare) {
    var b = m.querySelector(".edit-salveaza");
    if (da) { b.textContent = "Se salvează…"; b.disabled = true; }
    else { b.textContent = "Eroare: " + (eroare && eroare.message || eroare); b.disabled = false; }
  }

  /* ================= pozele ================= */
  var creioanePlutitoare = [];
  function creioaneImagini() {
    document.querySelectorAll("img").forEach(function (img) {
      // pozele desenate de scripturi au editoarele lor (lot, stiri)
      if (img.closest("#lot-app, .stiri-grila, .lb-cadru, .edit-modal, .edit-bara")) return;
      if (img.classList.contains("edit-creion")) return;
      var b = document.createElement("button");
      b.className = "edit-creion plutitor"; b.type = "button"; b.textContent = "🖼️";
      b.title = "Schimbă poza";
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        editeazaPoza(img);
      });
      document.body.appendChild(b);
      creioanePlutitoare.push([b, img]);
    });
    aseazaCreioanePlutitoare();
    // pozele care se incarca tarziu isi muta locul
    window.addEventListener("load", aseazaCreioanePlutitoare);
  }
  function aseazaCreioanePlutitoare() {
    creioanePlutitoare.forEach(function (per) {
      var b = per[0], img = per[1];
      var r = img.getBoundingClientRect();
      if (!r.width || !r.height) { b.style.display = "none"; return; }
      b.style.display = "grid";
      b.style.left = (scrollX + r.left + 8) + "px";
      b.style.top = (scrollY + r.top + 8) + "px";
    });
  }

  /* alegatorul de imagine: upload (optimizat, publicat in repo) sau link.
     `laGata(caleRootRelativaSauUrl)` primeste valoarea finala. */
  function alegePoza(m, contFolder, laGata) {
    var zona = m.querySelector(".edit-cai");
    zona.innerHTML = '<div class="edit-cale" id="cale-fisier">📁 Încarcă de pe calculator<br>' +
      "<small>se optimizează automat</small></div>" +
      '<div class="edit-cale" id="cale-link">🔗 Lipește un link<br><small>adresa unei imagini</small></div>' +
      '<input type="file" accept="image/*" hidden>';
    var fisier = zona.querySelector("input[type=file]");
    zona.querySelector("#cale-fisier").addEventListener("click", function () { fisier.click(); });
    zona.querySelector("#cale-link").addEventListener("click", function () {
      var url = prompt("Adresa imaginii (https://…):");
      if (url) laGata(url.trim());
    });
    fisier.addEventListener("change", function () {
      var f = fisier.files[0];
      if (!f) return;
      zona.innerHTML = "Se optimizează și se publică…";
      optimizeaza(f).then(function (blob) {
        var nume = contFolder + "/" + Date.now() + "-" +
          f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").slice(0, 30) + ".webp";
        var cititor = new FileReader();
        cititor.onload = function () {
          var b64 = String(cititor.result).split(",")[1];
          apiScrie(VERSIUNE + "/" + nume, b64, "poză încărcată (" + nume + ")", null)
            .then(function () { laGata(nume); })
            .catch(function (e) { zona.innerHTML = "Eroare: " + e.message; });
        };
        cititor.readAsDataURL(blob);
      });
    });
  }
  function optimizeaza(f) {
    return new Promise(function (rezolva) {
      var img = new Image();
      img.onload = function () {
        var MAX = 1920;
        var scara = Math.min(1, MAX / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scara);
        c.height = Math.round(img.height * scara);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { rezolva(b || f); }, "image/webp", 0.85);
      };
      img.onerror = function () { rezolva(f); };
      img.src = URL.createObjectURL(f);
    });
  }

  function editeazaPoza(img) {
    var cheie = cheieImg(img);
    var m = modal("<h3>Poza: " + cheie.split("|")[1] + "</h3>" +
      '<img class="edit-poza-prev" src="' + img.src + '">' +
      '<div class="edit-cai"></div>' +
      '<div class="butoane">' +
      (continut.img[cheie] ? '<button class="edit-sterge" type="button">Revino la poza originală</button>' : "") +
      '<button class="edit-renunta" type="button">Închide</button></div>');
    m.querySelector(".edit-renunta").addEventListener("click", function () { m.remove(); });
    var sterge = m.querySelector(".edit-sterge");
    if (sterge) sterge.addEventListener("click", function () {
      salveazaJson("continut.json", function (j) {
        j = formatNou(j); delete j.img[cheie]; return j;
      }, "poză readusă la original").then(function () { location.reload(); });
    });
    alegePoza(m, "assets/img/incarcate", function (valoare) {
      salveazaJson("continut.json", function (j) {
        j = formatNou(j); j.img[cheie] = valoare; return j;
      }, "poză schimbată (" + cheie + ")").then(function () {
        continut.img[cheie] = valoare;
        img.setAttribute("data-edit-orig", cheie.split("|")[1]);
        aplicaImg(img);
        m.remove();
        aseazaCreioanePlutitoare();
      }).catch(function (e) { m.querySelector(".edit-cai").innerHTML = "Eroare: " + e.message; });
    });
  }

  /* ================= fundalurile speciale ================= */
  function creioaneFundaluri() {
    document.querySelectorAll("[data-edit-fundal]").forEach(function (el) {
      var b = document.createElement("button");
      b.className = "edit-creion plutitor"; b.type = "button"; b.textContent = "🎬";
      b.title = "Schimbă fundalul: " + el.getAttribute("data-edit-fundal");
      document.body.appendChild(b);
      creioanePlutitoare.push([b, el]);
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var cheie = el.getAttribute("data-edit-fundal");
        var m = modal("<h3>Fundal: " + cheie + "</h3>" +
          '<p style="font:13px/1.5 Manrope; color:#47617f; margin-bottom:8px">' +
          (el.tagName === "VIDEO" ? "Clip video (link .mp4) sau imagine." : "Imaginea de fundal a acestei zone.") + "</p>" +
          '<div class="edit-cai"></div>' +
          '<div class="butoane">' +
          (continut.fundal[cheie] ? '<button class="edit-sterge" type="button">Revino la original</button>' : "") +
          '<button class="edit-renunta" type="button">Închide</button></div>');
        m.querySelector(".edit-renunta").addEventListener("click", function () { m.remove(); });
        var sterge = m.querySelector(".edit-sterge");
        if (sterge) sterge.addEventListener("click", function () {
          salveazaJson("continut.json", function (j) {
            j = formatNou(j); delete j.fundal[cheie]; return j;
          }, "fundal readus la original").then(function () { location.reload(); });
        });
        alegePoza(m, "assets/img/incarcate", function (valoare) {
          salveazaJson("continut.json", function (j) {
            j = formatNou(j); j.fundal[cheie] = valoare; return j;
          }, "fundal schimbat (" + cheie + ")").then(function () {
            continut.fundal[cheie] = valoare;
            aplicaFundalValoare(el, valoare);
            m.remove();
          }).catch(function (e) { m.querySelector(".edit-cai").innerHTML = "Eroare: " + e.message; });
        });
      });
    });
    aseazaCreioanePlutitoare();
  }

  /* ================= lotul, direct din pagina ================= */
  function modulLot() {
    var aplicatie = document.getElementById("lot-app");
    if (!aplicatie) return;
    var sport = aplicatie.getAttribute("data-sport") || "fotbal";

    // butonul plutitor cu lista completa
    var barae = document.querySelector(".edit-bara");
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "👥 Lotul";
    b.addEventListener("click", function () { listaLot(sport); });
    barae.insertBefore(b, barae.lastElementChild);

    // creion pe cardul deschis din evantai; verificam si imediat, si cu
    // intarziere — primul card se deschide in timpul construirii evantaiului,
    // posibil inainte ca observatorul sa fie la datorie
    function puneCreionPeCard() {
      var deschis = aplicatie.querySelector(".jcard.deschis");
      if (!deschis || deschis.querySelector(".edit-creion")) return;
      var creion = document.createElement("button");
      creion.className = "edit-creion"; creion.type = "button"; creion.textContent = "✏️";
      creion.style.cssText = "top:10px; left:10px; position:absolute; z-index:20";
      creion.title = "Editează jucătorul";
      creion.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var nume = (deschis.querySelector(".g-nume, .j-nume") || {}).textContent || "";
        apiCiteste(VERSIUNE + "/data/echipe.json").then(function (f) {
          var j = JSON.parse(f.text);
          var lot = j[sport].lot;
          var idx = lot.findIndex(function (x) {
            return nume.toLowerCase().indexOf(x.nume.split(" ").pop().toLowerCase()) !== -1 ||
                   x.nume.toLowerCase().indexOf(nume.trim().toLowerCase()) !== -1;
          });
          if (idx === -1) { listaLot(sport); return; }
          editeazaJucator(sport, idx);
        });
      });
      deschis.appendChild(creion);
    }
    var observator = new MutationObserver(puneCreionPeCard);
    observator.observe(aplicatie, { subtree: true, attributes: true, attributeFilter: ["class"] });
    puneCreionPeCard();
    setTimeout(puneCreionPeCard, 1200);
    setTimeout(puneCreionPeCard, 3000);
  }

  function listaLot(sport) {
    apiCiteste(VERSIUNE + "/data/echipe.json").then(function (f) {
      var j = JSON.parse(f.text);
      var lot = j[sport].lot;
      var m = modal("<h3>Lotul de " + sport + " (" + lot.length + ")</h3>" +
        '<div class="edit-lista">' + lot.map(function (x, i) {
          return '<div class="edit-rand"><span>#' + (x.numar != null ? x.numar : "—") + " " + x.nume +
            (x.poza ? " 📷" : "") + "</span>" +
            '<button data-ed="' + i + '" type="button">Editează</button>' +
            '<button class="rosu" data-st="' + i + '" type="button">Scoate</button></div>';
        }).join("") + "</div>" +
        '<div class="butoane"><button class="edit-salveaza" id="lot-plus" type="button">+ Adaugă jucător</button>' +
        '<button class="edit-renunta" type="button">Închide</button></div>');
      m.querySelector(".edit-renunta").addEventListener("click", function () { m.remove(); });
      m.querySelector("#lot-plus").addEventListener("click", function () {
        m.remove(); editeazaJucator(sport, -1);
      });
      m.querySelectorAll("[data-ed]").forEach(function (x) {
        x.addEventListener("click", function () { m.remove(); editeazaJucator(sport, parseInt(x.dataset.ed, 10)); });
      });
      m.querySelectorAll("[data-st]").forEach(function (x) {
        x.addEventListener("click", function () {
          var i = parseInt(x.dataset.st, 10);
          if (!confirm("Îl scoți din lot pe " + lot[i].nume + "?")) return;
          salveazaLot(sport, function (lotViu) { lotViu.splice(i, 1); })
            .then(function () { location.reload(); });
        });
      });
    });
  }

  function editeazaJucator(sport, idx) {
    apiCiteste(VERSIUNE + "/data/echipe.json").then(function (f) {
      var j = JSON.parse(f.text);
      var e = idx === -1 ? { numar: "", nume: "", post: "", nat: "România", poza: "" } : j[sport].lot[idx];
      var m = modal("<h3>" + (idx === -1 ? "Jucător nou" : e.nume) + "</h3>" +
        '<label>Număr<input type="number" id="jc-numar" value="' + (e.numar != null ? e.numar : "") + '"></label>' +
        '<label>Nume complet<input type="text" id="jc-nume" value="' + (e.nume || "").replace(/"/g, "&quot;") + '"></label>' +
        '<label>Post<input type="text" id="jc-post" value="' + (e.post || "").replace(/"/g, "&quot;") + '"></label>' +
        '<label>Naționalitate<input type="text" id="jc-nat" value="' + (e.nat || "").replace(/"/g, "&quot;") + '"></label>' +
        "<label>Portret</label>" +
        (e.poza ? '<img class="edit-poza-prev" src="' + RAD + e.poza + '">' : "") +
        '<div class="edit-cai"></div>' +
        '<input type="hidden" id="jc-poza" value="' + (e.poza || "") + '">' +
        '<div class="butoane">' +
        (e.poza ? '<button class="edit-sterge" id="jc-fara-poza" type="button">Fără portret (siluetă)</button>' : "") +
        '<button class="edit-renunta" type="button">Renunță</button>' +
        '<button class="edit-salveaza" type="button">Salvează pe site</button></div>');
      m.querySelector(".edit-renunta").addEventListener("click", function () { m.remove(); });
      var faraPoza = m.querySelector("#jc-fara-poza");
      if (faraPoza) faraPoza.addEventListener("click", function () {
        m.querySelector("#jc-poza").value = "";
        faraPoza.textContent = "✓ va rămâne siluetă";
      });
      alegePoza(m, "assets/img/lot/" + sport, function (valoare) {
        m.querySelector("#jc-poza").value = valoare;
        var prev = m.querySelector(".edit-poza-prev");
        if (!prev) {
          prev = document.createElement("img"); prev.className = "edit-poza-prev";
          m.querySelector(".edit-cai").before(prev);
        }
        prev.src = srcAplicabil(valoare);
      });
      m.querySelector(".edit-salveaza").addEventListener("click", function () {
        ocupat(m, true);
        var numar = m.querySelector("#jc-numar").value;
        var nou = {
          numar: numar === "" ? null : parseInt(numar, 10),
          nume: m.querySelector("#jc-nume").value.trim(),
          post: m.querySelector("#jc-post").value.trim(),
          nat: m.querySelector("#jc-nat").value.trim()
        };
        var poza = m.querySelector("#jc-poza").value;
        salveazaLot(sport, function (lotViu) {
          var baza = idx === -1 ? {} : lotViu[idx];
          var complet = Object.assign({}, baza, nou);
          if (poza) {
            complet.poza = poza;
            complet.pozaCredit = "Fotografie încărcată din panoul de administrare";
          } else { delete complet.poza; delete complet.pozaCredit; }
          if (idx === -1) lotViu.push(complet); else lotViu[idx] = complet;
        }).then(function () { location.reload(); })
          .catch(function (e2) { ocupat(m, false, e2); });
      });
    });
  }

  function salveazaLot(sport, modifica) {
    return salveazaJson("echipe.json", function (j) {
      modifica(j[sport].lot);
      return j;
    }, "lot " + sport + " editat din pagină").then(function () {
      // lotul editat manual nu mai e rescris de actualizarea automata
      return salveazaJson("suprascrieri.json", function (s) {
        s.lot = s.lot || {}; s.lot[sport] = true; return s;
      }, "lot " + sport + " marcat manual");
    });
  }
})();
