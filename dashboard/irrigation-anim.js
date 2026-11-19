/* Sāqiya — animation réelle de l'arrosage goutte-à-goutte, posée sur la vraie photo de la parcelle.
   Les gaines noires et les goutteurs de la photo sont repérés (coordonnées relatives à l'image 1200×675).
   Quand la pompe tourne : l'eau circule dans les gaines, une goutte se forme et tombe à chaque goutteur,
   et une tache d'humidité s'étend sous chacun au fil des minutes. Un compteur suit la vraie pompe. */
(function () {
  const IMG_W = 1200, IMG_H = 675, POS_Y = 0.62;          // même cadrage que « center 62% / cover »
  // gaines visibles sur la photo (début → fin, en fraction de l'image)
  const HOSES = [
    [[0.00, 0.26], [0.19, 0.54], [0.42, 1.00]],
    [[0.33, 0.34], [0.60, 0.69], [0.81, 0.93]],
    [[0.62, 0.29], [0.80, 0.40], [1.00, 0.53]],
  ];
  const STEP = 0.075;                                      // un goutteur tous les ~7 % de la longueur d'une gaine

  let cvs, ctx, raf = 0, on = false, startedAt = 0, emitters = [], hosePaths = [], box = null, drops = [], rings = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
  function along(h, t) {   // point sur une gaine (polyligne à 3 points)
    const a = h[0], b = h[1], c = h[2];
    return t < 0.5 ? lerp(a, b, t * 2) : lerp(b, c, (t - 0.5) * 2);
  }

  function layout() {
    const sc = document.getElementById("scene");
    const w = sc.clientWidth, h = sc.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!w || !h) { box = null; emitters = []; hosePaths = []; return; }   // pas encore visible : on mesurera plus tard
    cvs.width = w * dpr; cvs.height = h * dpr; cvs.style.width = w + "px"; cvs.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.max(w / IMG_W, h / IMG_H), iw = IMG_W * s, ih = IMG_H * s;
    box = { x: (w - iw) * 0.5, y: (h - ih) * POS_Y, w: iw, h: ih, scale: s };
    const P = (p) => [box.x + p[0] * box.w, box.y + p[1] * box.h];
    hosePaths = HOSES.map((hz) => hz.map(P));
    emitters = [];
    HOSES.forEach((hz, i) => {
      for (let t = 0.06; t < 0.98; t += STEP) {
        const [x, y] = P(along(hz, t));
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        const depth = 0.55 + 0.45 * (y / h);                 // plus près = plus gros (perspective)
        emitters.push({ x, y, depth, hose: i, phase: Math.random(), period: rnd(0.9, 1.6) });
      }
    });
  }

  function frame(tms) {
    raf = requestAnimationFrame(frame);
    const sc = cvs.parentElement;
    if (!sc.clientWidth) return;                                     // page Parcelle masquée : rien à dessiner
    if (!box || Math.abs(sc.clientWidth - cvs.clientWidth) > 1 || Math.abs(sc.clientHeight - cvs.clientHeight) > 1) layout();
    if (!box) return;
    const t = tms / 1000;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const running = (Date.now() / 1000 - startedAt);       // secondes depuis le début réel de l'arrosage
    const grow = 1 - Math.exp(-running / 140);             // la tache s'étend vite au début puis se stabilise

    // 1) taches d'humidité sous chaque goutteur (terre plus sombre, légèrement brillante)
    for (const e of emitters) {
      const r = Math.max(10, (6 + 34 * grow) * e.depth * box.scale * 1.6) * (0.55 + 0.45 * grow);   // jamais trop petit sur téléphone
      ctx.save();
      ctx.translate(e.x, e.y + 2 * e.depth);
      ctx.scale(1, 0.42);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(28, 16, 8, .55)");
      g.addColorStop(0.6, "rgba(28, 16, 8, .32)");
      g.addColorStop(1, "rgba(28, 16, 8, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      const sh = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 0.7);
      sh.addColorStop(0, "rgba(190, 215, 255, .10)"); sh.addColorStop(1, "rgba(190, 215, 255, 0)");
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 2) l'eau qui circule dans les gaines : reflets qui avancent
    ctx.lineCap = "round";
    hosePaths.forEach((p, i) => {
      ctx.save();
      ctx.setLineDash([Math.max(8, 10 * box.scale * 2), Math.max(26, 46 * box.scale * 2)]);
      ctx.lineDashOffset = -t * 90 * box.scale * 2 - i * 13;
      ctx.strokeStyle = "rgba(170, 215, 255, .38)";
      ctx.lineWidth = Math.max(2.4, 3.2 * box.scale * 1.6);
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.stroke();
      ctx.restore();
    });

    // 3) gouttes : se forment au goutteur, tombent, éclaboussent
    for (const e of emitters) {
      const k = ((t / e.period) + e.phase) % 1;
      const R = Math.max(2.8, 2.6 * e.depth * Math.max(0.9, box.scale * 1.6));   // gouttes visibles même sur petit écran
      if (k < 0.7) {                                       // la goutte grossit
        drawDrop(e.x, e.y - 1, R * (0.35 + 0.65 * (k / 0.7)));
      } else {                                             // elle tombe
        const f = (k - 0.7) / 0.3;
        drawDrop(e.x, e.y - 1 + f * f * 9 * e.depth, R);
        if (f > 0.92 && !e.splashed) { rings.push({ x: e.x, y: e.y + 9 * e.depth, r: R, a: 0.6, d: e.depth }); e.splashed = true; }
      }
      if (k < 0.1) e.splashed = false;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += 0.35 * r.d; r.a -= 0.025;
      if (r.a <= 0) { rings.splice(i, 1); continue; }
      ctx.save(); ctx.translate(r.x, r.y); ctx.scale(1, 0.35);
      ctx.strokeStyle = `rgba(200, 225, 255, ${r.a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r.r * 1.8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  function drawDrop(x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, "rgba(255, 255, 255, .95)");
    g.addColorStop(0.35, "rgba(205, 230, 255, .85)");
    g.addColorStop(1, "rgba(120, 170, 220, .55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.5);
    ctx.bezierCurveTo(x + r, y - r * 0.4, x + r, y + r, x, y + r);
    ctx.bezierCurveTo(x - r, y + r, x - r, y - r * 0.4, x, y - r * 1.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(10, 45, 90, .55)";   // léger contour : la goutte reste visible sur une terre claire
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  function hud(s) {
    const el = document.getElementById("irr-hud");
    if (!el) return;
    const p = s.pump || {};
    el.hidden = !p.on;
    if (!p.on) return;
    const AR = window.LANG === "ar";
    const total = (p.running_for_s || 0) + (p.seconds_remaining || 0);
    const pct = total ? Math.min(100, ((p.running_for_s || 0) / total) * 100) : 0;
    const lpm = s.settings?.pump_flow_lpm || 10;
    const litres = ((p.running_for_s || 0) / 60) * lpm;
    const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
    const m = s.latest_reading?.soil_moisture;
    el.innerHTML = `
      <div class="hd"><b>${AR ? "السقي بالتنقيط جارٍ" : "Arrosage goutte-à-goutte"}</b><span>${p.mode === "auto" ? (AR ? "تلقائي" : "automatique") : (AR ? "يدوي" : "manuel")}</span></div>
      <div class="row"><span>${AR ? "المتبقي" : "Reste"}</span><b dir="ltr">${mmss(p.seconds_remaining || 0)}</b>
        <span>${AR ? "الماء" : "Eau"}</span><b dir="ltr">≈ ${litres.toFixed(1).replace(".", AR ? "." : ",")} L</b>
        ${m != null ? `<span>${AR ? "التربة" : "Sol"}</span><b dir="ltr">${String(m.toFixed(1)).replace(".", AR ? "." : ",")} %</b>` : ""}</div>
      <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>`;
  }

  function setOn(v, s) {
    const p = s.pump || {};
    if (v) startedAt = Date.now() / 1000 - (p.running_for_s || 0);
    if (v === on) return;
    on = v;
    cvs.hidden = !on;
    if (on) { layout(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, cvs.width, cvs.height); rings = []; }
  }

  window.renderIrrigationAnim = function (s) {
    const sc = document.getElementById("scene");
    if (!sc || !s) return;
    if (!cvs) {
      cvs = document.createElement("canvas");
      cvs.className = "irr-canvas"; cvs.hidden = true; cvs.setAttribute("aria-hidden", "true");
      sc.insertBefore(cvs, sc.querySelector(".scene-tags"));
      ctx = cvs.getContext("2d");
      window.addEventListener("resize", () => { if (on) layout(); });
      document.addEventListener("visibilitychange", () => { if (on) { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); } });
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOn(!!s.pump?.on && !reduce, s);
    hud(s);
  };
})();
