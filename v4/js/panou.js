/* Panoul de administrare — publică modificări direct în repository prin
   API-ul GitHub. Două ținte: „Publică test" scrie pe ramura `test`
   (csmslatina.ro/test/), „Publică live" pe `main` (site-ul public).
   Token-ul stă doar în browserul administratorului.

   Ce se poate face de aici:
   - Știri (cu poză încărcată de pe calculator)
   - Anunțuri și concursuri (pagini scanate sau PDF, încărcate de pe calculator)
   - Documente de interes public (organigramă, rapoarte, bilanțuri, bugete)
   - Loturile de handbal și fotbal
   - Juniori: ascunderea unui copil sau a pozei lui din datele FRF
   - Sportivii secțiilor individuale (box, tenis de masă): cifre și palmares
   - Meciuri, tarifele hărții, editarea în pagină

   O publicare = UN singur commit cu toate fișierele modificate (JSON-uri și
   fișierele încărcate), făcut prin API-ul git (blob → tree → commit → ref),
   ca site-ul să se republice o singură dată, nu de zece ori. */
(function () {
  "use strict";

  var REPO = "calateodor/csm-slatina";
  /* Două ținte de publicare, două ramuri:
       test -> ramura `test` -> csmslatina.ro/test/   (o vede doar cine are linkul)
       live -> ramura `main` -> site-ul public
     Ramura de pe care s-au citit datele se ține minte (localStorage), ca să
     putem avertiza când se publică pe cealaltă: ai suprascrie ce e acolo. */
  var RAMURI = { test: "test", live: "main" };
  var LIVE_ACTIV = true;    // site-ul e pe www.csmslatina.ro: ramura main = live
  var LINK_TEST = "https://www.csmslatina.ro/test/";
  var RELEU_JUNIORI = "https://csm-live.worker-live.workers.dev/juniori";
  function tinta() { return localStorage.getItem("panou_ramura") === "test" ? "test" : "live"; }
  function ramura(t) { return RAMURI[t || tinta()]; }
  var VERSIUNE = (location.pathname.match(/\/(v\d+)\//) || [null, "v4"])[1];
  var PREFIX = VERSIUNE + "/data/";
  var API = "https://api.github.com/repos/" + REPO;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ================= API GitHub ================= */
  function token() { return localStorage.getItem("panou_token") || ""; }
  function anteturi() {
    return { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" };
  }
  function b64text(text) { return btoa(unescape(encodeURIComponent(text))); }
  function textB64(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, "")))); }

  function citeste(fisier, ram) {
    return fetch(API + "/contents/" + PREFIX + fisier + "?ref=" + (ram || ramura()),
      { headers: anteturi() }).then(function (r) {
      if (r.status === 404) return { date: null, sha: null };
      if (!r.ok) throw new Error("GitHub " + r.status);
      return r.json().then(function (j) {
        return { date: JSON.parse(textB64(j.content)), sha: j.sha };
      });
    });
  }
  // scrierea unui singur fișier (folosită doar la prima configurare)
  function scrie(fisier, date, mesaj, ram) {
    ram = ram || ramura();
    return citeste(fisier, ram).then(function (f) {
      var corp = {
        message: "panou: " + mesaj, branch: ram,
        content: b64text(JSON.stringify(date, null, 2))
      };
      if (f.sha) corp.sha = f.sha;
      return fetch(API + "/contents/" + PREFIX + fisier, {
        method: "PUT", headers: anteturi(), body: JSON.stringify(corp)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.message || r.status); });
        return r.json();
      });
    });
  }

  function apiJson(metoda, cale, corp) {
    return fetch(API + cale, {
      method: metoda, headers: Object.assign({ "Content-Type": "application/json" }, anteturi()),
      body: corp ? JSON.stringify(corp) : undefined
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (e) {
        throw new Error(e.message || ("GitHub " + r.status));
      });
      return r.json();
    });
  }
  // există fișierul (cale relativă la rădăcina site-ului) pe ramura dată?
  function existaPeRamura(cale, ram) {
    return fetch(API + "/contents/" + VERSIUNE + "/" + cale + "?ref=" + ram, { headers: anteturi() })
      .then(function (r) { return r.ok; });
  }
  // conținutul (base64) al unui fișier de pe o ramură; peste 1 MB trece prin blob
  function iaB64DePeRamura(cale, ram) {
    return fetch(API + "/contents/" + VERSIUNE + "/" + cale + "?ref=" + ram, { headers: anteturi() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        if (j.content && j.encoding === "base64") return j.content.replace(/\n/g, "");
        return apiJson("GET", "/git/blobs/" + j.sha).then(function (b) { return b.content.replace(/\n/g, ""); });
      });
  }
  /* Un commit cu mai multe fișiere deodată. `fisiere` = [{cale (de la
     rădăcina repo-ului), text | b64}]. Progresul se raportează pe pași. */
  function commitMultiplu(ram, fisiere, mesaj, progres) {
    var refCale = "/git/refs/heads/" + ram;
    var capSha, treeSha, intrari = [];
    return apiJson("GET", refCale).then(function (ref) {
      capSha = ref.object.sha;
      return apiJson("GET", "/git/commits/" + capSha);
    }).then(function (c) {
      treeSha = c.tree.sha;
      var i = 0;
      return (function urmatorul() {
        if (i >= fisiere.length) return Promise.resolve();
        var f = fisiere[i++];
        if (progres) progres("Se urcă " + f.cale.split("/").pop() + " (" + i + "/" + fisiere.length + ")");
        var corp = f.b64 != null ? { content: f.b64, encoding: "base64" } : { content: f.text, encoding: "utf-8" };
        return apiJson("POST", "/git/blobs", corp).then(function (b) {
          intrari.push({ path: f.cale, mode: "100644", type: "blob", sha: b.sha });
          return urmatorul();
        });
      })();
    }).then(function () {
      if (progres) progres("Se scrie commit-ul…");
      return apiJson("POST", "/git/trees", { base_tree: treeSha, tree: intrari });
    }).then(function (t) {
      return apiJson("POST", "/git/commits", { message: "panou: " + mesaj, tree: t.sha, parents: [capSha] });
    }).then(function (c) {
      return apiJson("PATCH", refCale, { sha: c.sha, force: false });
    });
  }

  /* ================= starea ================= */
  var stiri = null;        // stiri.json
  var anunturi = null;     // anunturi.json (anunțuri și concursuri)
  var documente = null;    // documente.json (informații de interes public)
  var echipe = null;       // echipe.json
  var meciuri = null;      // meciuri.json
  var suprascrieri = null; // suprascrieri.json
  var tarife = null;       // tarife.json (prețurile pinurilor de pe hartă)
  var ajustariJuniori = null; // juniori-ajustari.json
  var juniori = [];        // sosirile FRF (din releu sau copia salvată), doar pentru afișare
  var sportivi = { box: null, tm: null }; // box.json, tenis-de-masa.json
  var murdare = {};        // ce fișiere au modificări nepublicate
  var sportCurent = "handbal";

  /* Fișierele alese de pe calculator în sesiunea asta, încă nepublicate sau
     publicate doar pe o ramură: cale (relativă la rădăcina site-ului) ->
     { b64, ramuri: { test: true } }. Plus căile referite de elementele editate
     în sesiune, ca la publicarea pe cealaltă ramură să copiem ce lipsește. */
  var fisiere = {};
  var caiAtinse = {};
  function atinge(cale) { if (cale && !/^https?:/.test(cale)) caiAtinse[cale] = true; }

  var NUME_FISIERE = {
    "stiri.json": "știri", "anunturi.json": "anunțuri", "documente.json": "documente",
    "echipe.json": "loturi", "meciuri.json": "meciuri", "suprascrieri.json": "suprascrieri",
    "tarife.json": "tarife", "juniori-ajustari.json": "juniori", "box.json": "box",
    "tenis-de-masa.json": "tenis de masă"
  };
  function marcheaza(fisier) {
    murdare[fisier] = true;
    var bara = document.getElementById("pn-publica");
    bara.hidden = false;
    bara.classList.remove("fara-modificari");
    document.getElementById("pn-publica-text").textContent =
      "Modificări nepublicate: " + Object.keys(murdare).map(function (f) { return NUME_FISIERE[f] || f; }).join(", ");
  }

  /* bara plutitoare de publicare e mereu vizibilă când ești logat; fără
     modificări arată doar de unde s-au citit datele și linkul spre test */
  function stareBara() {
    var t = tinta();
    var bara = document.getElementById("pn-publica");
    bara.hidden = false;
    var goale = !Object.keys(murdare).length;
    bara.classList.toggle("fara-modificari", goale);
    if (goale) {
      document.getElementById("pn-publica-text").innerHTML =
        "Datele sunt citite de pe <b>" + (t === "test" ? "TEST" : "LIVE") + "</b>" +
        ' · <a href="' + LINK_TEST + '" target="_blank" rel="noopener">vezi testul</a>';
    }
    var live = document.getElementById("pn-publica-live");
    live.disabled = !LIVE_ACTIV;
    live.title = LIVE_ACTIV ? "Trimite pe site-ul public"
                            : "Se activează la trecerea site-ului pe csmslatina.ro";
    document.querySelectorAll("[data-tinta]").forEach(function (b) {
      b.classList.toggle("activ", b.dataset.tinta === t);
    });
  }
  window.addEventListener("beforeunload", function (e) {
    if (Object.keys(murdare).length) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ================= poarta: utilizator + parolă =================
     Parola nu e „verificată" nicăieri — e cheia care decriptează token-ul
     GitHub, salvat criptat (AES-GCM, cheie derivată PBKDF2) în
     data/acces.json. Parolă greșită = decriptarea eșuează = nu intri. */
  var poarta = document.getElementById("pn-poarta");
  var panou = document.getElementById("pn-panou");
  var eroare = document.getElementById("pn-poarta-eroare");

  function b64laOcteti(b64) {
    var s2 = atob(b64), a2 = new Uint8Array(s2.length);
    for (var i = 0; i < s2.length; i++) a2[i] = s2.charCodeAt(i);
    return a2;
  }
  function octetiLaB64(a2) {
    var s2 = "";
    new Uint8Array(a2).forEach(function (x) { s2 += String.fromCharCode(x); });
    return btoa(s2);
  }
  function cheiaDinParola(parola, sare, iteratii) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(parola), "PBKDF2", false, ["deriveKey"])
      .then(function (baza) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: sare, iterations: iteratii, hash: "SHA-256" },
          baza, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  function intra() {
    fetch(API, { headers: anteturi() })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 ? "Token invalid sau expirat." : "GitHub " + r.status);
        poarta.hidden = true; panou.hidden = false;
        incarcaTot();
      })
      .catch(function (e) {
        eroare.textContent = e.message;
        poarta.hidden = false;
      });
  }

  // ce formular arătăm: login dacă există acces.json, altfel prima configurare
  function pregatestePoarta() {
    fetch("data/acces.json?v=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (acces) {
        var login = document.getElementById("pn-login");
        var setup = document.getElementById("pn-setup");
        login.hidden = !acces;
        setup.hidden = !!acces;
        if (acces) {
          var u = document.getElementById("pn-user");
          if (acces.utilizator) u.value = acces.utilizator;
          function incearca() {
            eroare.textContent = "";
            if (u.value.trim() !== acces.utilizator) {
              eroare.textContent = "Utilizator sau parolă greșite."; return;
            }
            var parola = document.getElementById("pn-parola").value;
            if (!parola) return;
            cheiaDinParola(parola, b64laOcteti(acces.sare), acces.iteratii || 600000)
              .then(function (cheie) {
                return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64laOcteti(acces.iv) },
                                             cheie, b64laOcteti(acces.blob));
              })
              .then(function (descifrat) {
                localStorage.setItem("panou_token", new TextDecoder().decode(descifrat));
                intra();
              })
              .catch(function () { eroare.textContent = "Utilizator sau parolă greșite."; });
          }
          document.getElementById("pn-intra").addEventListener("click", incearca);
          document.getElementById("pn-parola").addEventListener("keydown", function (e) {
            if (e.key === "Enter") incearca();
          });
        } else {
          document.getElementById("pn-configureaza").addEventListener("click", function () {
            eroare.textContent = "";
            var t = document.getElementById("pn-token").value.trim();
            var u2 = document.getElementById("pn-setup-user").value.trim();
            var parola = document.getElementById("pn-setup-parola").value;
            if (!t || !u2 || parola.length < 6) {
              eroare.textContent = "Completează token-ul, utilizatorul și o parolă de minim 6 caractere.";
              return;
            }
            localStorage.setItem("panou_token", t);
            var sare = crypto.getRandomValues(new Uint8Array(16));
            var iv = crypto.getRandomValues(new Uint8Array(12));
            var iteratii = 600000;
            cheiaDinParola(parola, sare, iteratii)
              .then(function (cheie) {
                return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cheie,
                                             new TextEncoder().encode(t));
              })
              .then(function (blob) {
                var acces2 = {
                  utilizator: u2, iteratii: iteratii,
                  sare: octetiLaB64(sare), iv: octetiLaB64(iv), blob: octetiLaB64(blob)
                };
                return scrie("acces.json", acces2, "acces cu parolă configurat");
              })
              .then(intra)
              .catch(function (e) { eroare.textContent = "Eroare: " + e.message; });
          });
        }
      });
  }

  document.getElementById("pn-iesire").addEventListener("click", function () {
    localStorage.removeItem("panou_token");
    localStorage.setItem("panou_editare", "0");
    location.reload();
  });
  if (token()) { intra(); } else { poarta.hidden = false; pregatestePoarta(); }

  /* ================= încărcare ================= */
  function citesteSauGol(fisier) {
    return citeste(fisier).catch(function () { return { date: null }; });
  }
  function incarcaTot() {
    Promise.all([
      citeste("stiri.json"), citeste("echipe.json"), citeste("meciuri.json"),
      citeste("suprascrieri.json"), citesteSauGol("tarife.json"),
      citesteSauGol("anunturi.json"), citesteSauGol("documente.json"),
      citesteSauGol("juniori-ajustari.json"), citesteSauGol("box.json"),
      citesteSauGol("tenis-de-masa.json")
    ]).then(function (r) {
        stiri = r[0].date || { categorii: {}, stiri: [] };
        echipe = r[1].date;
        meciuri = r[2].date || { meciuri: [] };
        suprascrieri = r[3].date || { meciuri: {}, lot: {} };
        tarife = r[4].date || {};
        anunturi = r[5].date || { anunturi: [] };
        documente = r[6].date || { carduri: [], financiare: [] };
        ajustariJuniori = r[7].date || { ascunde: [], faraPoza: [] };
        sportivi.box = r[8].date;
        sportivi.tm = r[9].date;
        deseneazaStiri(); deseneazaAnunturi(); deseneazaDocumente(); deseneazaLot();
        deseneazaMeciuri(); deseneazaTarife(); deseneazaSportivi();
        incarcaJuniori();
        stareBara();
      })
      .catch(function (e) { alert("Nu am putut încărca datele: " + e.message); });
  }

  /* ================= navigarea între taburi ================= */
  var TABURI = ["stiri", "anunturi", "documente", "lot", "juniori", "sportivi", "meciuri", "tarife", "editare"];
  document.querySelectorAll(".pn-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".pn-tab").forEach(function (x) { x.classList.remove("activ"); });
      t.classList.add("activ");
      TABURI.forEach(function (nume) {
        var s = document.getElementById("tab-" + nume);
        if (s) s.hidden = nume !== t.dataset.tab;
      });
    });
  });

  /* ================= fișiere de pe calculator =================
     Pozele se optimizează în browser (canvas): scanurile devin JPEG de cel
     mult 2000px, pozele de știri WebP de cel mult 1600px. PDF-urile rămân
     ca atare. Nimic nu pleacă spre GitHub până la „Publică". */
  function slugDin(t) {
    return String(t || "").toLowerCase()
      .replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[șş]/g, "s").replace(/[țţ]/g, "t")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function alegeFisiere(accept, multiple) {
    return new Promise(function (rezolva) {
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = accept; inp.multiple = !!multiple; inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener("change", function () {
        var f = Array.prototype.slice.call(inp.files || []);
        inp.remove(); rezolva(f);
      });
      inp.click();
    });
  }
  function optimizeazaImagine(f, format, max, calitate) {
    return new Promise(function (rezolva) {
      var img = new Image();
      img.onload = function () {
        var scara = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scara);
        c.height = Math.round(img.height * scara);
        var ctx = c.getContext("2d");
        if (format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { rezolva(b || f); }, format, calitate);
      };
      img.onerror = function () { rezolva(f); };
      img.src = URL.createObjectURL(f);
    });
  }
  function blobLaB64(blob) {
    return new Promise(function (rezolva, respinge) {
      var cititor = new FileReader();
      cititor.onload = function () { rezolva(String(cititor.result).split(",")[1]); };
      cititor.onerror = function () { respinge(new Error("nu pot citi fișierul")); };
      cititor.readAsDataURL(blob);
    });
  }
  /* `fel`: "scan" (JPEG mare, pentru documente) sau "poza" (WebP, pentru
     ilustrații). Întoarce { b64, ext, nume, previzualizare }. */
  function pregatesteFisier(f, fel) {
    var ePdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
    var eImagine = /^image\//.test(f.type);
    if (!ePdf && !eImagine) return Promise.reject(new Error(f.name + ": doar imagini sau PDF"));
    if (ePdf) {
      if (f.size > 25 * 1024 * 1024) return Promise.reject(new Error(f.name + ": PDF-ul are peste 25 MB"));
      return blobLaB64(f).then(function (b64) {
        return { b64: b64, ext: "pdf", nume: f.name, previzualizare: null };
      });
    }
    var format = fel === "poza" ? "image/webp" : "image/jpeg";
    var max = fel === "poza" ? 1600 : 2000;
    return optimizeazaImagine(f, format, max, 0.84).then(function (blob) {
      return blobLaB64(blob).then(function (b64) {
        return { b64: b64, ext: fel === "poza" ? "webp" : "jpg", nume: f.name,
                 previzualizare: URL.createObjectURL(blob) };
      });
    });
  }
  // înregistrează un fișier pregătit sub calea finală și întoarce calea
  function pastreazaFisier(cale, pregatit) {
    fisiere[cale] = { b64: pregatit.b64, ramuri: {}, previzualizare: pregatit.previzualizare };
    atinge(cale);
    return cale;
  }
  function previzualizare(cale) {
    if (fisiere[cale] && fisiere[cale].previzualizare) return fisiere[cale].previzualizare;
    if (/\.pdf$/i.test(cale)) return null;
    return cale;
  }

  /* ================= editorul generic =================
     Tipuri de câmp: text (implicit), date, number, datetime-local, textarea,
     select, check, poza (text + „Încarcă de pe calculator", cu `folder`),
     fisiere (listă de pagini/PDF-uri cu adăugare și scoatere, cu `folder`
     și `prefix` pentru numele fișierelor noi). */
  var editor = document.getElementById("pn-editor");
  function deschideEditor(titlu, campuri, valori, laSalvare) {
    var h = '<div class="pn-cutie"><h3>' + esc(titlu) + "</h3>";
    var listeFisiere = {};   // cheie -> array de căi (pentru tipul „fisiere")
    campuri.forEach(function (c) {
      var v = valori[c.cheie];
      v = v == null ? "" : v;
      if (c.tip === "check") {
        h += '<label class="pn-check"><input type="checkbox" data-c="' + c.cheie + '"' + (v ? " checked" : "") + "> " + esc(c.nume) + "</label>";
        return;
      }
      if (c.tip === "fisiere") {
        listeFisiere[c.cheie] = (v || []).slice();
        h += '<div class="pn-camp-fisiere" data-lista="' + c.cheie + '"><span class="pn-eticheta">' + esc(c.nume) + "</span>" +
             '<div class="pn-fisiere"></div>' +
             '<div class="pn-fisiere-actiuni"><button class="pn-btn pn-btn-mic" type="button" data-adauga="' + c.cheie + '">📁 Adaugă pagini sau PDF</button>' +
             "<small>" + esc(c.nota || "pozele se optimizează automat; PDF-urile rămân ca atare") + "</small></div></div>";
        return;
      }
      h += "<label>" + esc(c.nume);
      if (c.tip === "textarea") {
        h += '<textarea data-c="' + c.cheie + '" rows="' + (c.randuri || 6) + '">' + esc(v) + "</textarea>";
      } else if (c.tip === "select") {
        h += '<select data-c="' + c.cheie + '">' + c.optiuni.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(v) === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>";
      } else if (c.tip === "poza") {
        h += '<span class="pn-poza-camp"><input type="text" data-c="' + c.cheie + '" value="' + esc(v) + '" placeholder="adresa imaginii sau încarcă de pe calculator">' +
             '<button class="pn-btn pn-btn-mic" type="button" data-poza="' + c.cheie + '" data-folder="' + esc(c.folder || "assets/img/incarcate") + '">📁 Încarcă</button></span>' +
             '<img class="pn-poza-prev" data-prev="' + c.cheie + '" alt=""' + (v ? ' src="' + esc(previzualizare(v) || "") + '"' : " hidden") + ">";
      } else {
        h += '<input type="' + (c.tip || "text") + '" data-c="' + c.cheie + '" value="' + esc(v) + '"' +
             (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : "") + ">";
      }
      h += "</label>";
    });
    h += '<div class="pn-butoane"><button class="pn-btn" id="ed-renunta" type="button">Renunță</button>' +
         '<button class="pn-btn pn-btn-plin" id="ed-ok" type="button">Gata</button></div></div>';
    editor.innerHTML = h; editor.hidden = false;
    editor.querySelector(".pn-cutie").scrollTop = 0;

    // listele de fișiere: desenare, scoatere, adăugare
    function deseneazaLista(cheie) {
      var gazda = editor.querySelector('[data-lista="' + cheie + '"] .pn-fisiere');
      var lista = listeFisiere[cheie];
      gazda.innerHTML = lista.map(function (cale, i) {
        var prev = previzualizare(cale);
        return '<div class="pn-fisier">' +
          (prev ? '<img src="' + esc(prev) + '" alt="">' : '<span class="pn-fisier-pdf">PDF</span>') +
          '<span class="pn-fisier-nume">' + esc(cale.split("/").pop()) + "</span>" +
          '<button class="pn-fisier-x" type="button" data-scoate="' + i + '" title="Scoate">✕</button></div>';
      }).join("") || '<p class="pn-nota">Niciun fișier încă.</p>';
      gazda.querySelectorAll("[data-scoate]").forEach(function (b) {
        b.addEventListener("click", function () {
          lista.splice(parseInt(b.dataset.scoate, 10), 1);
          deseneazaLista(cheie);
        });
      });
    }
    campuri.forEach(function (c) {
      if (c.tip !== "fisiere") return;
      deseneazaLista(c.cheie);
      editor.querySelector('[data-adauga="' + c.cheie + '"]').addEventListener("click", function () {
        var b = this;
        alegeFisiere("image/*,.pdf,application/pdf", !c.unul).then(function (alese) {
          if (!alese.length) return;
          b.disabled = true; b.textContent = "Se pregătesc…";
          var lista = listeFisiere[c.cheie];
          // numerotăm în continuarea celor existente, ca să nu suprascriem nimic
          var maxN = 0;
          lista.forEach(function (cale) {
            var m = cale.match(/-(\d+)\.[a-z0-9]+$/i);
            if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
          });
          var lant = Promise.resolve();
          if (c.unul) lista.length = 0;   // un singur document: cel nou îl înlocuiește pe cel vechi
          alese.forEach(function (f) {
            lant = lant.then(function () {
              return pregatesteFisier(f, "scan").then(function (p) {
                maxN += 1;
                var prefix = typeof c.prefix === "function" ? c.prefix(citesteValori()) : c.prefix;
                var folder = typeof c.folder === "function" ? c.folder(citesteValori()) : c.folder;
                lista.push(pastreazaFisier(folder + "/" + prefix + "-" + maxN + "." + p.ext, p));
              });
            });
          });
          return lant;
        }).catch(function (e) { alert(e.message); })
          .then(function () { b.disabled = false; b.textContent = "📁 Adaugă pagini sau PDF"; deseneazaLista(c.cheie); });
      });
    });
    // poza: încărcare de pe calculator
    editor.querySelectorAll("[data-poza]").forEach(function (b) {
      b.addEventListener("click", function () {
        alegeFisiere("image/*", false).then(function (alese) {
          if (!alese.length) return;
          b.disabled = true; b.textContent = "Se optimizează…";
          return pregatesteFisier(alese[0], "poza").then(function (p) {
            var cale = b.dataset.folder + "/" + Date.now().toString(36) + "-" + (slugDin(p.nume.replace(/\.[^.]+$/, "")) || "poza").slice(0, 30) + "." + p.ext;
            pastreazaFisier(cale, p);
            var inp = editor.querySelector('[data-c="' + b.dataset.poza + '"]');
            inp.value = cale;
            var prev = editor.querySelector('[data-prev="' + b.dataset.poza + '"]');
            prev.src = p.previzualizare; prev.hidden = false;
          });
        }).catch(function (e) { alert(e.message); })
          .then(function () { b.disabled = false; b.textContent = "📁 Încarcă"; });
      });
    });

    function citesteValori() {
      var out = {};
      editor.querySelectorAll("[data-c]").forEach(function (el) {
        out[el.dataset.c] = el.type === "checkbox" ? el.checked : el.value;
      });
      Object.keys(listeFisiere).forEach(function (k) { out[k] = listeFisiere[k].slice(); });
      return out;
    }
    document.getElementById("ed-renunta").addEventListener("click", function () { editor.hidden = true; });
    document.getElementById("ed-ok").addEventListener("click", function () {
      var out = citesteValori();
      editor.hidden = true;
      laSalvare(out);
    });
  }

  /* ================= ȘTIRI ================= */
  var CAMPURI_STIRE = function () {
    return [
      { cheie: "titlu", nume: "Titlu" },
      { cheie: "categorie", nume: "Categorie", tip: "select",
        optiuni: Object.keys(stiri.categorii).map(function (c) { return [c, stiri.categorii[c]]; }) },
      { cheie: "data", nume: "Data", tip: "date" },
      { cheie: "rezumat", nume: "Rezumat (o frază, apare pe card)" },
      { cheie: "corpText", nume: "Conținutul articolului (paragrafe separate prin linie goală)",
        tip: "textarea", randuri: 10 },
      { cheie: "poza", nume: "Poza articolului (opțional)", tip: "poza", folder: "assets/img/stiri" },
      { cheie: "publicat", nume: "Publicat pe site", tip: "check" }
    ];
  };
  function deseneazaStiri() {
    var lista = document.getElementById("stiri-lista");
    lista.innerHTML = stiri.stiri.map(function (s, i) {
      return '<div class="pn-rand"><div class="pn-info"><strong>' + esc(s.titlu) + "</strong>" +
        "<span>" + esc(stiri.categorii[s.categorie] || s.categorie) + " · " + esc(s.data) + (s.poza ? " · cu poză" : "") + "</span></div>" +
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
      if (!out.titlu.trim()) { alert("Știrea are nevoie de un titlu."); return; }
      var noua = {
        slug: e.slug || slugDin(out.titlu),
        categorie: out.categorie, data: out.data, titlu: out.titlu.trim(),
        rezumat: out.rezumat, poza: out.poza.trim() || null, publicat: !!out.publicat,
        corp: out.corpText.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      };
      atinge(noua.poza);
      if (idx === -1) stiri.stiri.unshift(noua); else stiri.stiri[idx] = noua;
      marcheaza("stiri.json"); deseneazaStiri();
    });
  }
  document.getElementById("stire-noua").addEventListener("click", function () { editeazaStirea(-1); });

  /* ================= ANUNȚURI ȘI CONCURSURI =================
     Fiecare anunț = titlu, dată, text opțional și paginile documentului
     (scanuri JPG sau PDF), puse în assets/anunturi/<an>/. Pagina publică
     (anunturi.html) le arată grupate pe ani, cele mai noi întâi. */
  var anunturiCautare = "";
  var anunturiAratate = 40;
  function anunturiSortate() {
    return anunturi.anunturi.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  }
  function deseneazaAnunturi() {
    var lista = document.getElementById("anunturi-lista");
    var q = slugDin(anunturiCautare);
    var toate = anunturiSortate().filter(function (a) {
      return !q || slugDin(a.titlu).indexOf(q) >= 0 || (a.data || "").indexOf(anunturiCautare.trim()) >= 0;
    });
    document.getElementById("anunturi-numar").textContent =
      toate.length + (toate.length === 1 ? " anunț" : " anunțuri") + (q ? " găsite" : " în arhivă");
    var felie = toate.slice(0, anunturiAratate);
    lista.innerHTML = felie.map(function (a) {
      var nr = (a.fisiere || []).length;
      var i = anunturi.anunturi.indexOf(a);
      return '<div class="pn-rand"><div class="pn-info"><strong>' + esc(a.titlu) + "</strong>" +
        "<span>" + esc(a.data) + " · " + (nr === 0 ? "fără document" : nr === 1 ? "1 pagină" : nr + " pagini") +
        (a.text ? " · cu text" : "") + "</span></div>" +
        '<a class="pn-btn pn-btn-mic" href="anunturi.html?a=' + encodeURIComponent(a.slug) + '" target="_blank" rel="noopener">Vezi</a>' +
        '<button class="pn-btn pn-btn-mic" data-ed="' + i + '" type="button">Editează</button>' +
        '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-st="' + i + '" type="button">Șterge</button></div>';
    }).join("") || '<p class="pn-nota">Niciun anunț' + (q ? " nu se potrivește căutării." : " încă.") + "</p>";
    if (toate.length > felie.length) {
      lista.innerHTML += '<button class="pn-btn" id="anunturi-mai-multe" type="button">Arată încă ' +
        Math.min(40, toate.length - felie.length) + " (din " + toate.length + ")</button>";
      document.getElementById("anunturi-mai-multe").addEventListener("click", function () {
        anunturiAratate += 40; deseneazaAnunturi();
      });
    }
    lista.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaAnunt(parseInt(b.dataset.ed, 10)); });
    });
    lista.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = anunturi.anunturi[parseInt(b.dataset.st, 10)];
        if (!confirm("Ștergi anunțul „" + a.titlu + "” din " + a.data + "?")) return;
        anunturi.anunturi.splice(parseInt(b.dataset.st, 10), 1);
        marcheaza("anunturi.json"); deseneazaAnunturi();
      });
    });
  }
  function slugAnunt(data, titlu) {
    var baza = data + "-" + (slugDin(titlu) || "anunt");
    var slug = baza, n = 2;
    while (anunturi.anunturi.some(function (a) { return a.slug === slug; })) slug = baza + "-" + (n++);
    return slug;
  }
  function editeazaAnunt(idx) {
    var a = idx === -1
      ? { titlu: "", data: new Date().toISOString().slice(0, 10), text: "", fisiere: [] }
      : anunturi.anunturi[idx];
    var campuri = [
      { cheie: "titlu", nume: "Titlu (ex. Anunț concurs, Rezultate probă scrisă, Raport final)" },
      { cheie: "data", nume: "Data publicării", tip: "date" },
      { cheie: "text", nume: "Text (opțional — de obicei documentul spune tot)", tip: "textarea", randuri: 3 },
      { cheie: "fisiere", nume: "Documentul: paginile scanate (JPG/PNG) sau PDF-ul, în ordine", tip: "fisiere",
        folder: function (v) { return "assets/anunturi/" + String(v.data || "").slice(0, 4); },
        prefix: function (v) { return a.slug || (String(v.data || "") + "-" + (slugDin(v.titlu) || "anunt")); } }
    ];
    deschideEditor(idx === -1 ? "Anunț nou" : "Editează anunțul", campuri, a, function (out) {
      if (!out.titlu.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(out.data)) {
        alert("Anunțul are nevoie de titlu și de dată."); return;
      }
      var nou = {
        slug: a.slug || slugAnunt(out.data, out.titlu),
        data: out.data, an: out.data.slice(0, 4), titlu: out.titlu.trim(),
        text: out.text.trim(), fisiere: out.fisiere
      };
      out.fisiere.forEach(atinge);
      if (idx === -1) anunturi.anunturi.unshift(nou); else anunturi.anunturi[idx] = nou;
      anunturi.actualizat = new Date().toISOString().slice(0, 10);
      marcheaza("anunturi.json"); deseneazaAnunturi();
    });
  }
  document.getElementById("anunt-nou").addEventListener("click", function () { editeazaAnunt(-1); });
  document.getElementById("anunturi-cauta").addEventListener("input", function () {
    anunturiCautare = this.value; anunturiAratate = 40; deseneazaAnunturi();
  });

  /* ================= DOCUMENTE (informații de interes public) =================
     documente.json are două părți: „carduri" (organigramă, rapoarte, buletin —
     un document fiecare, sau un link extern, sau o persoană de contact) și
     „financiare" (grupuri cu câte un rând pe an: bilanț, buget CCJ). */
  function deseneazaDocumente() {
    var gazda = document.getElementById("documente-lista");
    var carduri = documente.carduri || [];
    gazda.innerHTML = carduri.map(function (c, i) {
      var ce = c.fisier ? c.fisier.split("/").pop() : c.link ? "link extern" : c.persoana ? "persoană de contact" : "fără document";
      return '<div class="pn-rand"><div class="pn-info"><strong>' + esc(c.titlu) + "</strong><span>" +
        esc(c.eticheta || "") + (c.eticheta ? " · " : "") + esc(ce) + "</span></div>" +
        '<button class="pn-btn pn-btn-mic" data-ed="' + i + '" type="button">Editează</button>' +
        '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-st="' + i + '" type="button">Șterge</button></div>';
    }).join("") || '<p class="pn-nota">Niciun document.</p>';
    gazda.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaCardDocument(parseInt(b.dataset.ed, 10)); });
    });
    gazda.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = carduri[parseInt(b.dataset.st, 10)];
        if (!confirm("Scoți de pe pagină „" + c.titlu + "”?")) return;
        carduri.splice(parseInt(b.dataset.st, 10), 1);
        marcheaza("documente.json"); deseneazaDocumente();
      });
    });

    var fin = document.getElementById("financiare-lista");
    fin.innerHTML = (documente.financiare || []).map(function (g, gi) {
      return '<div class="pn-grup"><div class="pn-grup-cap"><strong>' + esc(g.titlu) + "</strong>" +
        '<button class="pn-btn pn-btn-mic" data-grup-ed="' + gi + '" type="button">Titlu și descriere</button>' +
        '<button class="pn-btn pn-btn-mic" data-rand-nou="' + gi + '" type="button">+ Adaugă an</button></div>' +
        (g.randuri || []).map(function (r, ri) {
          var nr = (r.fisiere || []).length;
          return '<div class="pn-rand"><div class="pn-info"><strong>' + esc(r.an) + " — " + esc(r.titlu) + "</strong><span>" +
            esc(r.publicat ? "publicat " + r.publicat : "") + (nr ? (r.publicat ? " · " : "") + nr + (nr === 1 ? " fișier" : " fișiere") : "") + "</span></div>" +
            '<button class="pn-btn pn-btn-mic" data-rand-ed="' + gi + ":" + ri + '" type="button">Editează</button>' +
            '<button class="pn-btn pn-btn-mic pn-btn-rosu" data-rand-st="' + gi + ":" + ri + '" type="button">Șterge</button></div>';
        }).join("") + "</div>";
    }).join("");
    fin.querySelectorAll("[data-grup-ed]").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = documente.financiare[parseInt(b.dataset.grupEd, 10)];
        deschideEditor("Grupul „" + g.titlu + "”", [
          { cheie: "titlu", nume: "Titlu" },
          { cheie: "descriere", nume: "Descriere", tip: "textarea", randuri: 3 }
        ], g, function (out) {
          g.titlu = out.titlu.trim(); g.descriere = out.descriere.trim();
          marcheaza("documente.json"); deseneazaDocumente();
        });
      });
    });
    fin.querySelectorAll("[data-rand-nou]").forEach(function (b) {
      b.addEventListener("click", function () { editeazaRandFinanciar(parseInt(b.dataset.randNou, 10), -1); });
    });
    fin.querySelectorAll("[data-rand-ed]").forEach(function (b) {
      var p = b.dataset.randEd.split(":");
      b.addEventListener("click", function () { editeazaRandFinanciar(parseInt(p[0], 10), parseInt(p[1], 10)); });
    });
    fin.querySelectorAll("[data-rand-st]").forEach(function (b) {
      var p = b.dataset.randSt.split(":");
      b.addEventListener("click", function () {
        var g = documente.financiare[parseInt(p[0], 10)];
        var r = g.randuri[parseInt(p[1], 10)];
        if (!confirm("Ștergi rândul „" + r.an + " — " + r.titlu + "”?")) return;
        g.randuri.splice(parseInt(p[1], 10), 1);
        marcheaza("documente.json"); deseneazaDocumente();
      });
    });
  }
  function editeazaCardDocument(idx) {
    var carduri = documente.carduri;
    var c = idx === -1 ? { id: "", titlu: "", eticheta: "", descriere: "", fisier: "" } : carduri[idx];
    var campuri = [
      { cheie: "titlu", nume: "Titlu" },
      { cheie: "eticheta", nume: "Etichetă (ex. PDF · 4 pagini, Legea nr. 361/2022)" },
      { cheie: "descriere", nume: "Descriere", tip: "textarea", randuri: 3 }
    ];
    if (c.persoana != null) {
      campuri.push({ cheie: "persoana", nume: "Persoana desemnată" });
      campuri.push({ cheie: "email", nume: "Adresa de e-mail pentru raportări" });
    } else if (c.link != null) {
      campuri.push({ cheie: "link", nume: "Adresa (https://…)" });
    } else {
      campuri.push({ cheie: "fisier", nume: "Documentul (PDF sau scan)", tip: "fisiere", unul: true,
        nota: "un singur fișier: cel nou îl înlocuiește pe cel vechi",
        folder: "assets/documente", prefix: function (v) { return (c.id || slugDin(v.titlu) || "document") + "-" + Date.now().toString(36); } });
    }
    var valori = Object.assign({}, c, { fisier: c.fisier ? [c.fisier] : [] });
    deschideEditor(idx === -1 ? "Document nou" : "Editează documentul", campuri, valori, function (out) {
      if (!out.titlu.trim()) { alert("Documentul are nevoie de un titlu."); return; }
      var nou = Object.assign({}, c, { titlu: out.titlu.trim(), eticheta: out.eticheta.trim(), descriere: out.descriere.trim() });
      if (!nou.id) nou.id = slugDin(out.titlu) || "document";
      if (out.persoana != null) { nou.persoana = out.persoana.trim(); nou.email = out.email.trim(); }
      else if (out.link != null) nou.link = out.link.trim();
      else {
        // ultimul fișier adăugat câștigă: cardul are un singur document
        nou.fisier = out.fisier.length ? out.fisier[out.fisier.length - 1] : "";
        atinge(nou.fisier);
      }
      if (idx === -1) carduri.push(nou); else carduri[idx] = nou;
      marcheaza("documente.json"); deseneazaDocumente();
    });
  }
  function editeazaRandFinanciar(gi, ri) {
    var g = documente.financiare[gi];
    g.randuri = g.randuri || [];
    var r = ri === -1 ? { an: String(new Date().getFullYear()), titlu: g.randuri[0] ? g.randuri[0].titlu : "", publicat: "", fisiere: [] } : g.randuri[ri];
    deschideEditor(ri === -1 ? "Rând nou în „" + g.titlu + "”" : "Editează rândul", [
      { cheie: "an", nume: "Anul sau sezonul (ex. 2025–2026)" },
      { cheie: "titlu", nume: "Titlul documentului" },
      { cheie: "publicat", nume: "Data publicării, în cuvinte (ex. 15 mai 2026 — opțional)" },
      { cheie: "fisiere", nume: "Fișierele: PDF-ul sau paginile scanate, în ordine", tip: "fisiere",
        folder: "assets/documente", prefix: function (v) { return (g.id || "fin") + "-" + (slugDin(v.an) || "an"); } }
    ], r, function (out) {
      if (!out.an.trim() || !out.titlu.trim()) { alert("Rândul are nevoie de an și de titlu."); return; }
      var nou = { an: out.an.trim(), titlu: out.titlu.trim(), publicat: out.publicat.trim(), fisiere: out.fisiere };
      out.fisiere.forEach(atinge);
      if (ri === -1) g.randuri.unshift(nou); else g.randuri[ri] = nou;
      marcheaza("documente.json"); deseneazaDocumente();
    });
  }
  document.getElementById("document-nou").addEventListener("click", function () { editeazaCardDocument(-1); });

  /* ================= LOT ================= */
  document.querySelectorAll("#lot-sport button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#lot-sport button").forEach(function (x) { x.classList.remove("activ"); });
      b.classList.add("activ");
      sportCurent = b.dataset.sport;
      deseneazaLot();
    });
  });
  // aceleași posturi ca pe paginile echipelor (js/lot.js), ca fiecare jucător să
  // intre într-o grupă și să aibă loc pe terenul desenat
  var POSTURI = {
    fotbal: ["Portar", "Fundaș central", "Fundaș lateral", "Mijlocaș central", "Mijlocaș lateral", "Atacant central", "Atacant lateral"],
    handbal: ["Portar", "Extremă stânga", "Extremă dreapta", "Pivot", "Inter stânga", "Inter dreapta", "Centru"]
  };
  function campuriJucator(j) {
    var posturi = POSTURI[sportCurent].slice();
    if (j.post && posturi.indexOf(j.post) < 0) posturi.unshift(j.post);
    return [
      { cheie: "numar", nume: "Număr", tip: "number" },
      { cheie: "nume", nume: "Nume complet" },
      { cheie: "post", nume: "Post", tip: "select", optiuni: posturi.map(function (p) { return [p, p]; }) },
      { cheie: "nat", nume: "Naționalitate" },
      { cheie: "nascut", nume: "Data nașterii (ex. 25.01.2001 — opțional)" },
      { cheie: "poza", nume: "Portret (opțional)", tip: "poza", folder: "assets/img/lot/" + sportCurent }
    ];
  }
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
      return '<div class="pn-rand"><div class="pn-info"><strong>#' + (j.numar != null ? esc(j.numar) : "—") +
        " " + esc(j.nume) + "</strong><span>" + esc(j.post || "post nesetat") +
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
    var j = idx === -1 ? { numar: "", nume: "", post: POSTURI[sportCurent][0], nat: "România", nascut: "", poza: "" } : lot[idx];
    deschideEditor(idx === -1 ? "Jucător nou" : "Editează jucătorul", campuriJucator(j), j, function (out) {
      if (!out.nume.trim()) { alert("Jucătorul are nevoie de un nume."); return; }
      var nou = Object.assign({}, j, {
        numar: out.numar === "" ? null : parseInt(out.numar, 10),
        nume: out.nume.trim(), post: out.post, nat: out.nat
      });
      if (out.nascut.trim()) nou.nascut = out.nascut.trim(); else delete nou.nascut;
      if (out.poza.trim()) { nou.poza = out.poza.trim(); atinge(nou.poza); } else delete nou.poza;
      if (idx === -1) lot.push(nou); else lot[idx] = nou;
      lotPeManual(); deseneazaLot();
    });
  }
  document.getElementById("lot-adauga").addEventListener("click", function () { editeazaJucator(-1); });

  /* ================= JUNIORI =================
     Lista vine din datele FRF (releul, sau copia salvată). De aici doar
     ascunzi un copil (la cererea părinților) sau îi scoți poza; restul
     ține de FRF. Ajustările stau în juniori-ajustari.json. */
  var juniorCautare = "";
  var SEZON = 2026;
  function grupaJunior(j) {
    var u = SEZON - j.an;
    if (j.gen === "F") return u >= 14 ? "U15 Fete" : (u >= 12 ? "U13 Fete" : "Inițiere Fete");
    return u < 10 ? "Inițiere" : "U" + u;
  }
  function incarcaJuniori() {
    fetch(RELEU_JUNIORI).then(function (r) { return r.json(); })
      .then(function (d) { if (!d || d.eroare || !d.jucatori || !d.jucatori.length) throw new Error("gol"); return d; })
      .catch(function () { return citeste("juniori.json").then(function (f) { return f.date || { jucatori: [] }; }); })
      .then(function (d) {
        juniori = (d.jucatori || []).slice().sort(function (a, b) {
          return a.nume < b.nume ? -1 : 1;
        });
        deseneazaJuniori();
      })
      .catch(function () {
        document.getElementById("juniori-lista").innerHTML = '<p class="pn-nota">Nu am putut citi lista de juniori.</p>';
      });
  }
  function deseneazaJuniori() {
    var gazda = document.getElementById("juniori-lista");
    var q = slugDin(juniorCautare);
    var lista = juniori.filter(function (j) { return !q || slugDin(j.nume).indexOf(q) >= 0; });
    var ascunsi = ajustariJuniori.ascunde || [], faraPoza = ajustariJuniori.faraPoza || [];
    document.getElementById("juniori-numar").textContent = lista.length + " copii" + (q ? " găsiți" : " în datele FRF");
    gazda.innerHTML = lista.map(function (j) {
      var ascuns = ascunsi.indexOf(j.id) >= 0, fp = faraPoza.indexOf(j.id) >= 0;
      return '<div class="pn-rand' + (ascuns ? " pn-rand-stins" : "") + '"><div class="pn-info"><strong>' + esc(j.nume) + "</strong><span>" +
        esc(grupaJunior(j)) + " · născut" + (j.gen === "F" ? "ă" : "") + " în " + esc(j.an) + (j.poza ? "" : " · FRF nu are poză") + "</span></div>" +
        (ascuns ? '<span class="pn-etic ciorna">Ascuns</span>' : "") +
        (fp && !ascuns ? '<span class="pn-etic manual">Fără poză</span>' : "") +
        '<button class="pn-btn pn-btn-mic" data-poza-j="' + esc(j.id) + '" type="button">' + (fp ? "Arată poza" : "Fără poză") + "</button>" +
        '<button class="pn-btn pn-btn-mic' + (ascuns ? "" : " pn-btn-rosu") + '" data-ascunde="' + esc(j.id) + '" type="button">' + (ascuns ? "Arată pe site" : "Ascunde") + "</button></div>";
    }).join("") || '<p class="pn-nota">Niciun copil nu se potrivește.</p>';
    function comuta(lista2, id) {
      var i = lista2.indexOf(id);
      if (i >= 0) lista2.splice(i, 1); else lista2.push(id);
      marcheaza("juniori-ajustari.json"); deseneazaJuniori();
    }
    gazda.querySelectorAll("[data-ascunde]").forEach(function (b) {
      b.addEventListener("click", function () {
        ajustariJuniori.ascunde = ajustariJuniori.ascunde || [];
        comuta(ajustariJuniori.ascunde, b.dataset.ascunde);
      });
    });
    gazda.querySelectorAll("[data-poza-j]").forEach(function (b) {
      b.addEventListener("click", function () {
        ajustariJuniori.faraPoza = ajustariJuniori.faraPoza || [];
        comuta(ajustariJuniori.faraPoza, b.dataset.pozaJ);
      });
    });
  }
  document.getElementById("juniori-cauta").addEventListener("input", function () {
    juniorCautare = this.value; deseneazaJuniori();
  });

  /* ================= SPORTIVII SECȚIILOR INDIVIDUALE =================
     Box (Arun Tudoroiu) și tenis de masă (Bianca Toma): cifrele cardului și
     palmaresul. Palmaresul se scrie un rând pe linie: an | text | categorie. */
  function palmaresText(p) {
    return (p || []).map(function (x) { return x.an + " | " + x.text + (x.categorie ? " | " + x.categorie : ""); }).join("\n");
  }
  function palmaresDinText(t) {
    return String(t || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.split("|").map(function (x) { return x.trim(); });
      return { an: /^\d+$/.test(p[0]) ? parseInt(p[0], 10) : p[0], text: p[1] || "", categorie: p[2] || "" };
    });
  }
  function intreg(v, vechi) { var n = parseInt(v, 10); return isNaN(n) ? vechi : n; }
  function deseneazaSportivi() {
    var b = sportivi.box && sportivi.box.sportiv, t = sportivi.tm && sportivi.tm.sportiv;
    document.getElementById("sportiv-box").innerHTML = b
      ? "<strong>" + esc(b.nume) + "</strong><span>" + esc(b.categorie) + " · " + esc(b.record.victorii) + "V " + esc(b.record.infrangeri) + "Î " + esc(b.record.egaluri) + "E · " + (b.palmares || []).length + " rânduri în palmares</span>"
      : "<strong>Box</strong><span>fără date</span>";
    document.getElementById("sportiv-tm").innerHTML = t
      ? "<strong>" + esc(t.nume) + "</strong><span>" + esc(t.categorie) + " · " + esc(t.medalii.aur) + " aur, " + esc(t.medalii.argint) + " argint, " + esc(t.medalii.bronz) + " bronz · " + (t.palmares || []).length + " rânduri în palmares</span>"
      : "<strong>Tenis de masă</strong><span>fără date</span>";
  }
  document.getElementById("sportiv-box-ed").addEventListener("click", function () {
    var s = sportivi.box && sportivi.box.sportiv;
    if (!s) return;
    var v = Object.assign({}, s, s.record, { antrenoriText: (s.antrenori || []).join(", "), palmaresText: palmaresText(s.palmares) });
    deschideEditor("Boxerul secției", [
      { cheie: "nume", nume: "Nume" },
      { cheie: "nascut", nume: "Anul nașterii", tip: "number" },
      { cheie: "categorie", nume: "Categoria de greutate" },
      { cheie: "victorii", nume: "Victorii", tip: "number" },
      { cheie: "infrangeri", nume: "Înfrângeri", tip: "number" },
      { cheie: "egaluri", nume: "Egaluri", tip: "number" },
      { cheie: "ko", nume: "Victorii prin KO", tip: "number" },
      { cheie: "meciuri", nume: "Meciuri", tip: "number" },
      { cheie: "runde", nume: "Runde", tip: "number" },
      { cheie: "procentKo", nume: "Procent KO (ex. 35,29%)" },
      { cheie: "loculRomania", nume: "Locul în România", tip: "number" },
      { cheie: "dinTotalRomania", nume: "…din câți boxeri în România", tip: "number" },
      { cheie: "loculMondial", nume: "Locul mondial", tip: "number" },
      { cheie: "dinTotalMondial", nume: "…din câți boxeri în lume", tip: "number" },
      { cheie: "debut", nume: "Debut (ex. 19 mai 2021)" },
      { cheie: "tinta", nume: "Țintă (ex. Jocurile Olimpice 2028)" },
      { cheie: "boxrec", nume: "Adresa BoxRec" },
      { cheie: "antrenoriText", nume: "Antrenori, despărțiți prin virgulă" },
      { cheie: "palmaresText", nume: "Palmares — un rând pe linie: an | text | categorie", tip: "textarea", randuri: 8 },
      { cheie: "poza", nume: "Fotografia", tip: "poza", folder: "assets/img/box" }
    ], v, function (o) {
      s.nume = o.nume.trim(); s.nascut = intreg(o.nascut, s.nascut); s.categorie = o.categorie.trim();
      s.record = { victorii: intreg(o.victorii, 0), infrangeri: intreg(o.infrangeri, 0), egaluri: intreg(o.egaluri, 0), ko: intreg(o.ko, 0) };
      ["meciuri", "runde", "loculRomania", "dinTotalRomania", "loculMondial", "dinTotalMondial"].forEach(function (k) { s[k] = intreg(o[k], s[k]); });
      ["procentKo", "debut", "tinta", "boxrec"].forEach(function (k) { s[k] = o[k].trim(); });
      s.antrenori = o.antrenoriText.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      s.palmares = palmaresDinText(o.palmaresText);
      s.poza = o.poza.trim(); atinge(s.poza);
      marcheaza("box.json"); deseneazaSportivi();
    });
  });
  document.getElementById("sportiv-tm-ed").addEventListener("click", function () {
    var s = sportivi.tm && sportivi.tm.sportiv;
    if (!s) return;
    var v = Object.assign({}, s, s.medalii, { antrenoriText: (s.antrenori || []).join(", "), palmaresText: palmaresText(s.palmares) });
    deschideEditor("Sportiva secției de tenis de masă", [
      { cheie: "nume", nume: "Nume (cum apare pe card)" },
      { cheie: "numeIntreg", nume: "Numele întreg" },
      { cheie: "varsta", nume: "Vârsta", tip: "number" },
      { cheie: "categorie", nume: "Categoria (ex. U13)" },
      { cheie: "sezon", nume: "Sezonul medaliilor (an)", tip: "number" },
      { cheie: "aur", nume: "Medalii de aur", tip: "number" },
      { cheie: "argint", nume: "Medalii de argint", tip: "number" },
      { cheie: "bronz", nume: "Medalii de bronz", tip: "number" },
      { cheie: "turneeWtt", nume: "Turnee WTT", tip: "number" },
      { cheie: "titluriNationale2025", nume: "Titluri naționale 2025", tip: "number" },
      { cheie: "insigna", nume: "Insigna de pe card (ex. #1 U11 în Europa)" },
      { cheie: "distinctii", nume: "Distincții" },
      { cheie: "surse", nume: "Sursele rezultatelor" },
      { cheie: "antrenoriText", nume: "Antrenori, despărțiți prin virgulă" },
      { cheie: "palmaresText", nume: "Palmares — un rând pe linie: an | text | categorie", tip: "textarea", randuri: 8 },
      { cheie: "poza", nume: "Fotografia", tip: "poza", folder: "assets/img/tenis-de-masa" }
    ], v, function (o) {
      ["nume", "numeIntreg", "categorie", "insigna", "distinctii", "surse"].forEach(function (k) { s[k] = o[k].trim(); });
      ["varsta", "sezon", "turneeWtt", "titluriNationale2025"].forEach(function (k) { s[k] = intreg(o[k], s[k]); });
      s.medalii = { aur: intreg(o.aur, 0), argint: intreg(o.argint, 0), bronz: intreg(o.bronz, 0) };
      s.antrenori = o.antrenoriText.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      s.palmares = palmaresDinText(o.palmaresText);
      s.poza = o.poza.trim(); atinge(s.poza);
      marcheaza("tenis-de-masa.json"); deseneazaSportivi();
    });
  });

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
      return '<div class="pn-rand"><div class="pn-info"><strong>' + esc(m.gazde) + " – " + esc(m.oaspeti) + "</strong>" +
        "<span>" + esc(m.sport) + " · " + esc(m.competitie) + " · " + candDin(m.timestamp).replace("T", " ") + "</span></div>" +
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

  /* ================= TARIFELE HĂRȚII ================= */
  function deseneazaTarife() {
    var gazda = document.getElementById("pn-tarife-lista");
    if (!gazda || !tarife) return;
    gazda.innerHTML = "";
    Object.keys(tarife).forEach(function (id) {
      var rand = document.createElement("div");
      rand.className = "pn-rand";
      var eticheta = document.createElement("strong");
      eticheta.textContent = tarife[id].nume || id;
      eticheta.style.flex = "0 0 220px";
      var camp = document.createElement("input");
      camp.type = "text";
      camp.value = tarife[id].tarif || "";
      camp.placeholder = "fără tarif afișat";
      camp.style.flex = "1";
      camp.addEventListener("input", function () {
        tarife[id].tarif = camp.value.trim();
        marcheaza("tarife.json");
      });
      rand.appendChild(eticheta);
      rand.appendChild(camp);
      gazda.appendChild(rand);
    });
  }

  /* ================= EDITARE ÎN PAGINĂ ================= */
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

  /* ================= PUBLICAREA =================
     Un singur commit pe ramura aleasă, cu toate JSON-urile modificate și cu
     fișierele încărcate în sesiune. Dacă un fișier referit de ce s-a editat
     lipsește de pe ramura țintă (de exemplu a fost publicat doar pe test),
     îl copiem de pe cealaltă ramură. */
  var CONTINUT = {
    "stiri.json": function () { return stiri; }, "anunturi.json": function () { return anunturi; },
    "documente.json": function () { return documente; }, "echipe.json": function () { return echipe; },
    "meciuri.json": function () { return meciuri; }, "suprascrieri.json": function () { return suprascrieri; },
    "tarife.json": function () { return tarife; }, "juniori-ajustari.json": function () { return ajustariJuniori; },
    "box.json": function () { return sportivi.box; }, "tenis-de-masa.json": function () { return sportivi.tm; }
  };
  function strangeFisierele(ram, progres) {
    var alta = ram === RAMURI.test ? RAMURI.live : RAMURI.test;
    var lista = [];
    var cai = Object.keys(caiAtinse);
    var i = 0;
    return (function urmatorul() {
      if (i >= cai.length) return Promise.resolve(lista);
      var cale = cai[i++];
      var p = fisiere[cale];
      if (p) {
        if (!p.ramuri[ram]) lista.push({ cale: VERSIUNE + "/" + cale, b64: p.b64, local: cale });
        return urmatorul();
      }
      progres("Se verifică " + cale.split("/").pop() + "…");
      return existaPeRamura(cale, ram).then(function (exista) {
        if (exista) return;
        return iaB64DePeRamura(cale, alta).then(function (b64) {
          if (b64) lista.push({ cale: VERSIUNE + "/" + cale, b64: b64, local: cale });
        });
      }).then(urmatorul);
    })();
  }
  function publica(t) {
    var ram = RAMURI[t];
    var deUnde = tinta();
    if (!Object.keys(murdare).length) { alert("Nu e nimic de publicat."); return; }
    if (t !== deUnde &&
        !confirm("Datele au fost citite de pe " + deUnde.toUpperCase() + ", iar tu publici pe " +
                 t.toUpperCase() + ". Fișierele modificate vor suprascrie ce e acum pe " +
                 t.toUpperCase() + ". Continui?")) return;
    var b = document.getElementById(t === "test" ? "pn-publica-test" : "pn-publica-live");
    var text0 = b.textContent;
    var toate = document.querySelectorAll("#pn-publica button");
    toate.forEach(function (x) { x.disabled = true; });
    function progres(m) { b.textContent = m; }
    progres("Se publică…");
    var modificate = Object.keys(murdare);
    var mesaj = modificate.map(function (f) { return NUME_FISIERE[f] || f; }).join(", ") + " actualizate";
    strangeFisierele(ram, progres).then(function (lista) {
      modificate.forEach(function (f) {
        lista.push({ cale: PREFIX + f, text: JSON.stringify(CONTINUT[f](), null, 2) + "\n" });
      });
      return commitMultiplu(ram, lista, mesaj, progres).then(function () {
        lista.forEach(function (f) { if (f.local && fisiere[f.local]) fisiere[f.local].ramuri[ram] = true; });
      });
    }).then(function () {
      murdare = {};
      localStorage.setItem("panou_ramura", t);   // de acum datele sunt de pe ramura asta
      toate.forEach(function (x) { x.disabled = false; });
      b.textContent = text0;
      stareBara();
      alert(t === "test"
        ? "Publicat pe TEST. Apare în 1–2 minute la " + LINK_TEST
        : "Publicat pe LIVE. Site-ul public se actualizează în 1–2 minute.");
    }).catch(function (e) {
      toate.forEach(function (x) { x.disabled = false; });
      b.textContent = text0;
      stareBara();
      modificate.forEach(marcheaza);
      alert("Eroare la publicare: " + e.message + "\nNimic nu s-a scris; poți încerca din nou.");
    });
  }
  document.getElementById("pn-publica-test").addEventListener("click", function () { publica("test"); });
  document.getElementById("pn-publica-live").addEventListener("click", function () { publica("live"); });

  /* comutatorul „citesc datele de pe”: reîncarcă panoul de pe cealaltă ramură */
  document.querySelectorAll("[data-tinta]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.tinta === tinta()) return;
      if (Object.keys(murdare).length &&
          !confirm("Ai modificări nepublicate. Le pierzi dacă schimbi sursa. Continui?")) return;
      localStorage.setItem("panou_ramura", b.dataset.tinta);
      location.reload();
    });
  });
})();
