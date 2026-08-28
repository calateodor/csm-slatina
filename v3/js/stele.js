/* ==========================================================================
   Praful de stele al secțiunilor pline (v3) — WebGL
   Reconstrucție proprie a efectului de pe referința aleasă de Teo
   (ulrychkristian.cz, scena „portfolio night", stratul de tip wisps):
   o grilă rotită de puncte luminoase, fiecare respirând lent în celula lui,
   cu halo în 1/distanță (nu discuri!), sclipire puternică pe faze diferite,
   derivă globală abia perceptibilă și două straturi suprapuse la scări
   apropiate — compuse aditiv, în albastru pal.

   Interacțiunea cu mouse-ul, la fel ca pe referință: stelele din jurul
   cursorului sunt atrase ușor spre el, iar poziția cursorului nu e cea brută,
   ci urmărită printr-un arc cu inerție (spring + momentum) — de-aia reacția
   se simte plutită, cu întârziere elegantă, nu lipită de mouse.

   Manete (în PARAMETRI): luminozitate, scară, viteza sclipirii, atracția.
   Se prinde de fiecare .sectiune-plina și de .cta-banner. Dacă WebGL nu
   există, nu se întâmplă nimic — secțiunea rămâne cu degradeul ei CSS.
   ========================================================================== */
(function () {
  "use strict";

  var PARAMETRI = {
    luminozitate: 0.1,  // 0.1 = abia ghicit, 1 = cer plin
    scara: 5,          // câte celule pe lățime; mai mic = stele mai rare și mai mari
    ritmSclipire: 0.5,  // viteza pulsului; 0 = stele fixe
    paralax: 30,         // cat ramane cerul in urma la scroll (yPercent); 0 = fix
    atractie: 0.29,     // cat de tare trage cursorul stelele; 0 = deloc
    razaAtractie: 0.38, // cat de departe se simte atractia
    arc: 0.02642,       // cat de repede urmareste punctul-tinta cursorul
    inertie: 0.74,      // cata avantare pastreaza urmarirea (0 = sec, 0.9 = balans lung)
    culoare: "#8fcaff"  // culoarea stelelor (hex). Fundalul se schimba in CSS,
                        // la .sectiune-plina din style.css
  };

  // hex -> [r,g,b] in 0..1, pentru shader
  function hexRGB(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  var linistit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tinte = document.querySelectorAll(".sectiune-plina, .cta-banner, .cu-stele");
  if (!tinte.length) return;

  /* Shaderul: pentru fiecare pixel adunăm lumina celor 9 celule vecine din
     două grile jitterate. Lumina unui punct cade în 1/distanță — de-aia halo-ul
     se simte moale, „scump", nu ca un disc desenat. Sclipirea e un triunghi
     de fază per punct, deriva un offset global infim pe verticală. */
  var FS = [
    "precision highp float;",
    "uniform float uTimp;",
    "uniform vec2 uRez;",
    "uniform float uLum;",
    "uniform float uScara;",
    "uniform float uPuls;",
    "uniform vec2 uMouse;",
    "uniform float uAtractie;",
    "uniform float uRazaAtr;",
    "uniform vec3 uCuloare;",
    "vec2 hash2(vec2 p){",
    "  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));",
    "  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);",
    "}",
    "float caderea(float scara){",
    "  float rt = uRazaAtr * 1.5;",
    "  float rStart = 1.0 / (0.5 + scara * 2.0);",
    "  float r = mix(rStart, 2.0, rt);",
    "  return 1.0 / max(r, 0.0001);",
    "}",
    "float camp(vec2 st, vec2 soarece, float fSq, float t){",
    "  vec2 gi = floor(st);",
    "  float acc = 0.0;",
    "  for (int y = -1; y <= 1; y++) {",
    "    for (int x = -1; x <= 1; x++) {",
    "      vec2 cel = gi + vec2(float(x), float(y));",
    "      vec2 h = hash2(cel);",
    "      vec2 p = 0.5 + 0.5 * sin(5.0 + 0.034 * t + 6.2831 * h);",
    "      vec2 stea = cel + p;",
    "      vec2 spre = soarece - stea;",
    "      float dm2 = dot(spre, spre);",
    "      stea += spre * (uAtractie * 2.0 / (1.0 + dm2 * fSq * 8.0));",
    "      vec2 d = stea - st;",
    "      float d2 = dot(d, d);",
    "      float c = 0.06 * inversesqrt(max(d2, 0.0001));",
    "      c *= 1.0 - smoothstep(2.25, 5.76, d2);",
    "      float faza = p.x + p.y + h.x * 0.5 + t * uPuls;",
    "      float scl = 1.0 - abs(fract(faza) * 2.0 - 1.0);",
    "      c *= mix(1.0, 0.75 + scl, 0.96);",
    "      acc += mix(c * c, c * 2.0, 0.08);",
    "    }",
    "  }",
    "  return acc;",
    "}",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRez;",
    "  vec2 asp = vec2(uRez.x / uRez.y, 1.0);",
    "  float a = 1.859;",
    "  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));",
    "  vec2 b = (uv - vec2(0.96, 0.37)) * asp * R / asp;",
    "  vec2 deriva = vec2(0.0, uTimp * -0.00077);",
    "  vec2 mg = (uMouse - vec2(0.96, 0.37)) * asp * R / asp;",
    "  float f1 = caderea(uScara); f1 *= f1;",
    "  float f2 = caderea(uScara * 1.26); f2 *= f2;",
    "  float p1 = camp((b * uScara + deriva) * asp, (mg * uScara + deriva) * asp, f1, uTimp);",
    "  float p2 = camp((b * uScara * 1.26 + deriva) * asp + vec2(10.0), (mg * uScara * 1.26 + deriva) * asp + vec2(10.0), f2, uTimp);",
    "  float lum = (p1 * 0.02 + p2 * 0.04) * uLum;",
    "  vec3 col = clamp(lum * uCuloare, 0.0, 1.0);",
    "  float alfa = dot(col, vec3(0.299, 0.587, 0.114));",
    "  gl_FragColor = vec4(col, alfa);",
    "}"
  ].join("\n");

  var VS = "attribute vec2 aPoz; void main(){ gl_Position = vec4(aPoz, 0.0, 1.0); }";

  function pregateste(sectiune) {
    var panza = document.createElement("canvas");
    panza.className = "stele";
    panza.setAttribute("aria-hidden", "true");
    var gl = panza.getContext("webgl", { alpha: true, antialias: false, depth: false });
    if (!gl) return null;
    sectiune.insertBefore(panza, sectiune.firstChild);

    function shader(tip, sursa) {
      var s = gl.createShader(tip);
      gl.shaderSource(s, sursa); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        return null;
      }
      return s;
    }
    var vs = shader(gl.VERTEX_SHADER, VS);
    var fs = shader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "aPoz");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // compunere aditivă peste degradeul CSS al secțiunii
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var scena = {
      el: sectiune, panza: panza, gl: gl, vizibil: true,
      uTimp: gl.getUniformLocation(prog, "uTimp"),
      uRez: gl.getUniformLocation(prog, "uRez"),
      uLum: gl.getUniformLocation(prog, "uLum"),
      uScara: gl.getUniformLocation(prog, "uScara"),
      uPuls: gl.getUniformLocation(prog, "uPuls"),
      uMouse: gl.getUniformLocation(prog, "uMouse"),
      uAtractie: gl.getUniformLocation(prog, "uAtractie"),
      uRazaAtr: gl.getUniformLocation(prog, "uRazaAtr"),
      uCuloare: gl.getUniformLocation(prog, "uCuloare"),
      // urmarirea cursorului: pozitia desenata alearga dupa tinta cu arc+inertie
      tintaX: 0.5, tintaY: 0.5, mx: 0.5, my: 0.5, vx: 0, vy: 0
    };

    function masoara() {
      // cutia panzei, nu a sectiunii: panza e mai inalta (are surplus pentru
      // parallax), iar translatia nu schimba dimensiunile masurate
      var r = panza.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      panza.width = Math.max(1, Math.round(r.width * dpr));
      panza.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, panza.width, panza.height);
      if (linistit) deseneaza(scena, 40);   // și înghețat, cerul rămâne corect la resize
    }
    masoara();
    if ("ResizeObserver" in window) new ResizeObserver(masoara).observe(sectiune);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (i) { scena.vizibil = i[0].isIntersecting; }).observe(sectiune);
    }
    return scena;
  }

  function deseneaza(sc, t) {
    var gl = sc.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(sc.uTimp, t);
    gl.uniform2f(sc.uRez, sc.panza.width, sc.panza.height);
    gl.uniform1f(sc.uLum, PARAMETRI.luminozitate);
    gl.uniform1f(sc.uScara, PARAMETRI.scara);
    gl.uniform1f(sc.uPuls, linistit ? 0 : PARAMETRI.ritmSclipire);
    gl.uniform2f(sc.uMouse, sc.mx, sc.my);
    gl.uniform1f(sc.uAtractie, linistit ? 0 : PARAMETRI.atractie);
    gl.uniform1f(sc.uRazaAtr, PARAMETRI.razaAtractie);
    var c = hexRGB(PARAMETRI.culoare);
    gl.uniform3f(sc.uCuloare, c[0], c[1], c[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var scene = [];
  tinte.forEach(function (s) {
    var sc = pregateste(s);
    if (sc) scene.push(sc);
  });
  if (!scene.length) return;

  if (linistit) {
    // fără mișcare: un singur cadru, cerul rămâne dar stă
    scene.forEach(function (sc) { deseneaza(sc, 40); });
    return;
  }

  /* parallax la scroll: cerul ramane in urma continutului cat timp sectiunea
     traverseaza ecranul — pare mai in spate decat cardurile, care se misca
     1:1 cu derularea. Amplitudinea e in PARAMETRI.paralax; surplusul de 10%
     al panzei acopera cursa, deci nu se vad margini goale. */
  if (PARAMETRI.paralax && window.gsap && window.ScrollTrigger) {
    scene.forEach(function (sc) {
      gsap.fromTo(sc.panza,
        { yPercent: -PARAMETRI.paralax },
        {
          yPercent: PARAMETRI.paralax, ease: "none",
          scrollTrigger: {
            trigger: sc.el,
            start: "top bottom", end: "bottom top",
            scrub: 0.5
          }
        });
    });
  }

  // tinta: pozitia cursorului in spatiul fiecarei sectiuni (poate iesi din 0..1
  // cand cursorul e in alta parte a paginii — atunci atractia slabeste natural)
  window.addEventListener("mousemove", function (e) {
    for (var i = 0; i < scene.length; i++) {
      var r = scene[i].el.getBoundingClientRect();
      scene[i].tintaX = (e.clientX - r.left) / r.width;
      scene[i].tintaY = 1 - (e.clientY - r.top) / r.height;
    }
  }, { passive: true });

  function cadru(acum) {
    var t = acum / 1000;
    for (var i = 0; i < scene.length; i++) {
      var sc = scene[i];
      if (!sc.vizibil) continue;
      // arcul cu inertie: viteza castiga un pas spre tinta, pastreaza avantarea
      sc.vx = sc.vx * PARAMETRI.inertie + (sc.tintaX - sc.mx) * PARAMETRI.arc;
      sc.vy = sc.vy * PARAMETRI.inertie + (sc.tintaY - sc.my) * PARAMETRI.arc;
      sc.mx += sc.vx; sc.my += sc.vy;
      deseneaza(sc, t);
    }
    requestAnimationFrame(cadru);
  }
  requestAnimationFrame(cadru);
})();
