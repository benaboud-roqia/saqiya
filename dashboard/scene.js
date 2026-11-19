/* Sāqiya — scène animée de la parcelle.
   Tout est dessiné en SVG et piloté par les données réelles :
   heure du jour (ciel, soleil, lune), pluie (capteur + prévisions), nuages,
   humidité du sol (couleur de la terre, plantes qui flétrissent), pompe (eau dans le goutte-à-goutte). */
(function () {
  const W = 1200, H = 320, GROUND = 248;
  let lastKey = "";
  const rnd = mulberry(42);

  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const mix = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("");
  };

  function phaseOf(h) {
    if (h < 5.5 || h >= 20.5) return "nuit";
    if (h < 8) return "aube";
    if (h < 17.5) return "jour";
    return "soir";
  }
  const SKY = {
    nuit: ["#141b28", "#2f3b55", "#1f2a24", "#2a3a2c"],
    aube: ["#9fb6c9", "#f3d2ad", "#7f8f6a", "#98a679"],
    jour: ["#9fc4d4", "#e9efe6", "#8fa271", "#a9b788"],
    soir: ["#58587a", "#efa77b", "#6d7556", "#86906a"],
  };

  /* ---------------- plantes ---------------- */
  function leaf(x, y, rx, ry, rot, c) {
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="${c}"/>`;
  }
  function vegetable(fruit, flower) {
    const g = "#4f7a34", g2 = "#3e6629";
    let s = `<path d="M0 0 C -2 -14 2 -26 0 -40" stroke="${g2}" stroke-width="2.4" fill="none"/>`;
    s += leaf(-9, -12, 9, 4, -25, g) + leaf(9, -18, 9, 4, 25, g2) + leaf(-8, -27, 8, 3.5, -30, g2) + leaf(8, -33, 7, 3.2, 30, g) + leaf(0, -42, 5, 3, 0, g);
    if (fruit) s += fruit.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 3.2}" fill="#fff" opacity=".35"/>`).join("");
    if (flower) s += `<circle cx="-4" cy="-44" r="2.4" fill="#f6f1df"/><circle cx="5" cy="-38" r="2.2" fill="#f6f1df"/>`;
    return s;
  }
  function cereal() {
    let s = "";
    for (const [dx, h, lean] of [[-6, 46, -6], [-2, 52, -2], [3, 49, 3], [7, 44, 7]]) {
      s += `<path d="M${dx} 0 Q ${dx + lean / 2} ${-h / 2} ${dx + lean} ${-h}" stroke="#9aa55a" stroke-width="1.6" fill="none"/>`;
      s += `<ellipse cx="${dx + lean}" cy="${-h - 6}" rx="2.6" ry="7" transform="rotate(${lean * 2} ${dx + lean} ${-h - 6})" fill="#d4b35b"/>`;
    }
    return s;
  }
  function tree(fruitColor) {
    let s = `<path d="M-3 0 C -4 -20 -1 -34 -6 -48 M2 0 C 3 -18 1 -30 7 -46" stroke="#6b5a45" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    const blobs = [[-20, -58, 20], [8, -66, 22], [24, -52, 16], [-6, -76, 17], [-28, -44, 12]];
    s += blobs.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? "#6f8752" : "#7f9663"}"/>`).join("");
    for (let i = 0; i < 9; i++) s += `<circle cx="${-30 + rnd() * 56}" cy="${-82 + rnd() * 42}" r="${fruitColor === "#3d3b2c" ? 2.4 : 3.6}" fill="${fruitColor}"/>`;
    return s;
  }
  function vine() {
    let s = `<path d="M0 0 V -46" stroke="#6b5a45" stroke-width="3"/><path d="M-26 -42 H 26" stroke="#8a7a62" stroke-width="1.2"/>`;
    s += leaf(-14, -46, 10, 7, -10, "#5c8a3a") + leaf(12, -48, 10, 7, 12, "#4f7a34") + leaf(0, -54, 9, 6, 0, "#5c8a3a");
    for (const cx of [-10, 10]) for (let r = 0; r < 4; r++) for (let c = 0; c <= 3 - r; c++) s += `<circle cx="${cx - (3 - r) * 2 + c * 4}" cy="${-36 + r * 4}" r="2.4" fill="#5b3a63"/>`;
    return s;
  }
  function plantSvg(crop) {
    switch (crop) {
      case "tomate": return { svg: vegetable([[-7, -20, 4, "#c8452c"], [7, -27, 4.4, "#d5562f"], [-3, -33, 3.5, "#c8452c"]]), step: 58 };
      case "poivron": return { svg: vegetable([[-7, -21, 3.6, "#3e7b2b"], [7, -27, 3.8, "#cf4b29"]]), step: 58 };
      case "fraise": return { svg: vegetable([[-9, -8, 3, "#cf3a3a"], [9, -10, 3, "#cf3a3a"]], true).replace(/-4[0-4]/g, (m) => m), step: 46 };
      case "pomme_de_terre": return { svg: vegetable(null, true), step: 56 };
      case "ble": return { svg: cereal(), step: 26 };
      case "olivier": return { svg: tree("#3d3b2c"), step: 150, tall: true };
      case "agrumes": return { svg: tree("#e8952f"), step: 140, tall: true };
      case "vigne": return { svg: vine(), step: 80 };
      default: return { svg: vegetable([[-7, -20, 4, "#c8452c"]]), step: 58 };
    }
  }

  /* ---------------- construction ---------------- */
  function cloud(x, y, s, dark) {
    const c = dark ? "#9aa3a6" : "#ffffff";
    return `<g opacity="${dark ? .95 : .9}" transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="46" ry="16" fill="${c}"/><ellipse cx="-18" cy="-10" rx="22" ry="17" fill="${c}"/>
      <ellipse cx="14" cy="-14" rx="26" ry="20" fill="${c}"/><ellipse cx="38" cy="-2" rx="18" ry="12" fill="${c}"/></g>`;
  }

  function build(o) {
    const [top, bottom, hill1, hill2] = o.rainy ? ["#7f8b92", "#c4ccc9", "#6e7b62", "#86917a"] : SKY[o.phase];
    let s = `<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
      <linearGradient id="soilg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#fff6d8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>`;

    // étoiles et lune / soleil
    if (o.phase === "nuit" && !o.rainy) {
      for (let i = 0; i < 60; i++) s += `<circle class="star" cx="${rnd() * W}" cy="${rnd() * 170}" r="${rnd() * 1.3 + .3}" fill="#fff" style="animation-delay:${(rnd() * 3).toFixed(2)}s"/>`;
    }
    s += `<g id="astre"></g>`;

    // collines
    s += `<path d="M0 ${GROUND - 40} C 160 ${GROUND - 90}, 300 ${GROUND - 70}, 470 ${GROUND - 52} S 760 ${GROUND - 98}, 940 ${GROUND - 62} S 1120 ${GROUND - 70}, 1200 ${GROUND - 58} V ${GROUND} H 0 Z" fill="${hill1}" opacity=".75"/>`;
    s += `<path d="M0 ${GROUND - 18} C 220 ${GROUND - 46}, 380 ${GROUND - 30}, 600 ${GROUND - 26} S 980 ${GROUND - 50}, 1200 ${GROUND - 24} V ${GROUND} H 0 Z" fill="${hill2}"/>`;

    // nuages
    const nClouds = 2 + Math.round(o.rainProb / 22) + (o.rainy ? 3 : 0);
    for (let i = 0; i < nClouds; i++) {
      const dur = 70 + rnd() * 70;
      s += `<g class="cloud" style="animation-duration:${dur.toFixed(0)}s;animation-delay:-${(rnd() * dur).toFixed(0)}s">${cloud(0, 40 + rnd() * 80, .6 + rnd() * .7, o.rainy || o.rainProb > 60)}</g>`;
    }

    // sol
    s += `<rect class="soil-top-layer" id="soil-layer" x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#a07a4e"/>`;
    s += `<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#soilg)"/>`;
    for (let i = 0; i < 4; i++) s += `<path d="M0 ${GROUND + 18 + i * 16} H ${W}" stroke="#000" stroke-opacity=".07" stroke-width="1"/>`;
    for (let i = 0; i < 50; i++) s += `<circle cx="${rnd() * W}" cy="${GROUND + 6 + rnd() * 66}" r="${rnd() * 1.6 + .4}" fill="#000" opacity=".12"/>`;

    // rangées de plantes
    const p = plantSvg(o.crop);
    const start = 250;
    // rangée arrière (petite, plus claire)
    for (let x = start + p.step / 2; x < W - 10; x += p.step) {
      s += `<g transform="translate(${x} ${GROUND - 2}) scale(${p.tall ? .6 : .8})" opacity=".78"><g class="plant" style="animation-delay:-${(rnd() * 5).toFixed(2)}s">${p.svg}</g></g>`;
    }
    // goutte-à-goutte + rangée avant
    const lineY = GROUND + 22;
    s += `<path d="M194 ${lineY} H ${W}" stroke="#2b2b2b" stroke-width="4" stroke-linecap="round"/>`;
    s += `<path class="flow" d="M194 ${lineY} H ${W}" stroke="#7fc3e6" stroke-width="2"/>`;
    for (let x = start; x < W - 10; x += p.step) {
      s += `<ellipse class="wet-spot" cx="${x}" cy="${lineY + 10}" rx="${Math.min(p.step / 2.4, 26)}" ry="6" fill="#2e2216"/>`;
      s += `<g transform="translate(${x} ${lineY + 2}) scale(${p.tall ? 1.1 : 1.5})"><g class="plant" style="animation-delay:-${(rnd() * 5).toFixed(2)}s">${p.svg}</g></g>`;
      s += `<circle class="drip" cx="${x + 6}" cy="${lineY + 3}" r="2.2" fill="#7fc3e6" style="animation-delay:${(rnd() * 1.1).toFixed(2)}s"/>`;
    }

    // abri de pompe
    s += `<g transform="translate(70 ${GROUND - 54})">
      <path d="M0 22 L40 0 L80 22 Z" fill="#8c4a2f"/><rect x="6" y="22" width="68" height="56" fill="#d9cbb0"/>
      <rect x="6" y="22" width="68" height="56" fill="none" stroke="#000" stroke-opacity=".15"/>
      <rect x="18" y="40" width="44" height="30" rx="3" fill="#3b4a52"/>
      <g class="impeller"><circle cx="40" cy="55" r="10" fill="#5b6f79"/><path d="M40 45 V 65 M30 55 H 50 M33 48 L47 62 M47 48 L33 62" stroke="#c9d6dc" stroke-width="2"/></g>
      <path d="M62 62 H 92 V 76 H 124" stroke="#2b2b2b" stroke-width="4" fill="none"/>
      <path class="flow" d="M62 62 H 92 V 76 H 124" stroke="#7fc3e6" stroke-width="2" fill="none"/>
    </g>`;
    // capteur IoT
    s += `<g transform="translate(200 ${GROUND - 64})">
      <path d="M8 0 V 88" stroke="#5a5a52" stroke-width="3"/>
      <rect x="-4" y="6" width="24" height="18" rx="2" fill="#efe9da" stroke="#5a5a52"/>
      <circle class="led" cx="14" cy="15" r="2.6" fill="${o.online ? "#7ed36a" : "#e2603a"}"/>
      <path d="M8 6 V -10 M4 -6 Q 8 -12 12 -6 M1 -9 Q 8 -18 15 -9" stroke="#5a5a52" stroke-width="1.3" fill="none"/>
      <rect x="2" y="40" width="12" height="6" fill="#efe9da" stroke="#5a5a52"/>
    </g>`;

    // pluie
    if (o.rainy) {
      s += `<g class="rain">`;
      for (let i = 0; i < 90; i++) s += `<line x1="${rnd() * (W + 60)}" y1="${rnd() * 120}" x2="${0}" y2="${0}" style="animation-delay:${(rnd() * .7).toFixed(2)}s;animation-duration:${(.55 + rnd() * .35).toFixed(2)}s"/>`;
      s += `</g>`;
    }
    // filtre nocturne
    if (o.phase === "nuit") s += `<rect width="${W}" height="${H}" fill="#0b1020" opacity=".28" pointer-events="none"/>`;
    return s.replace(/<line x1="([\d.]+)" y1="([\d.]+)" x2="0" y2="0"/g, (_, x, y) => `<line x1="${x}" y1="${y}" x2="${(+x - 7).toFixed(1)}" y2="${(+y + 16).toFixed(1)}"`);
  }

  function astre(phase, hour, rainy) {
    if (rainy) return "";
    if (phase === "nuit") {
      const t = ((hour + 4) % 24) / 9;
      const x = 160 + t * 880, y = 120 - Math.sin(Math.min(1, t) * Math.PI) * 70;
      return `<circle cx="${x}" cy="${y}" r="30" fill="url(#glow)"/><circle cx="${x}" cy="${y}" r="15" fill="#f1ead2"/><circle cx="${x + 7}" cy="${y - 4}" r="13" fill="#25304a"/>`;
    }
    const t = Math.max(0, Math.min(1, (hour - 6) / 14));
    const x = 120 + t * 960, y = 190 - Math.sin(t * Math.PI) * 140;
    let rays = "";
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; rays += `<path d="M${(Math.cos(a) * 30).toFixed(1)} ${(Math.sin(a) * 30).toFixed(1)} L${(Math.cos(a) * 40).toFixed(1)} ${(Math.sin(a) * 40).toFixed(1)}" stroke="#f6d77a" stroke-width="2.4" stroke-linecap="round"/>`; }
    const col = phase === "jour" ? "#f8d667" : "#f4a960";
    return `<circle cx="${x}" cy="${y}" r="70" fill="url(#glow)"/><g transform="translate(${x} ${y})"><g class="sun-rays">${rays}</g><circle r="22" fill="${col}"/></g>`;
  }

  // moniteur posé sur la photo : les vraies mesures du capteur, avec un code couleur simple
  function renderMonitor(s, r) {
    const el = document.getElementById("scene-mon");
    if (!el) return;
    if (!r || r.ts == null) { el.hidden = true; return; }
    const AR = window.LANG === "ar";
    const ph = s.crop?.ph || [6, 7], ecMax = s.crop?.ec_max ?? 2.5, th = s.thresholds || {};
    const lv = (v, lo, hi) => v == null ? "" : v < lo ? "low" : v > hi ? "high" : "ok";
    const items = [
      ["soil_moisture", AR ? "رطوبة التربة" : "Humidité sol", "%", 1, lv(r.soil_moisture, th.threshold, (th.target ?? 60) + 15)],
      ["soil_temp", AR ? "حرارة التربة" : "T° sol", "°C", 1, ""],
      ["soil_ph", "pH", "", 1, lv(r.soil_ph, ph[0], ph[1])],
      ["soil_ec", AR ? "الملوحة" : "Salinité", "dS/m", 2, lv(r.soil_ec, -1, ecMax)],
    ].filter(([k]) => r[k] != null);
    if (!items.length) { el.hidden = true; return; }
    const age = Date.now() / 1000 - r.ts;
    const ago = age < 90 ? (AR ? "الآن" : "à l'instant") : age < 3600 ? (AR ? `منذ ${Math.round(age / 60)} د` : `il y a ${Math.round(age / 60)} min`) : (AR ? `منذ ${Math.round(age / 3600)} سا` : `il y a ${Math.round(age / 3600)} h`);
    const src = (r.device_id || "").includes("7en1") ? (AR ? "مستشعر 7 في 1" : "Capteur 7-en-1") : (AR ? "مستشعر التربة" : "Capteur du sol");
    const fmt = (v, d) => Number(v).toLocaleString(AR ? "ar-DZ" : "fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
    el.hidden = false;
    el.classList.toggle("stale", age > 600);
    el.setAttribute("data-noi18n", "");
    el.innerHTML = `<div class="hd"><b>${src}</b><span>${ago}</span></div><div class="grid">${items.map(([k, label, unit, d, cls]) =>
      `<div class="m ${cls}"><span>${label}</span><b dir="ltr">${fmt(r[k], d)}${unit ? `<small>${unit}</small>` : ""}</b></div>`).join("")}</div>`;
  }

  window.renderScene = function (s) {
    const el = document.getElementById("scene"), svg = document.getElementById("scene-svg");
    if (!el || !s) return;
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const phase = phaseOf(hour);
    const r = s.latest_reading || {};
    const w = s.weather || {};
    const rainy = !!r.rain_detected || (w.available && (w.current?.precipitation || 0) > 0);
    const rainProb = w.available ? (w.rain_prob_max_12h || 0) : 0;
    const crop = s.settings.crop;
    const m = r.soil_moisture;
    const { threshold, target } = s.thresholds;
    // le dessin SVG ne sert plus que si la photo réelle est désactivée par un thème
    if (getComputedStyle(svg).display !== "none") {
      const key = [crop, phase, rainy, Math.round(rainProb / 22), s.device_online].join("|");
      if (key !== lastKey) {
        svg.innerHTML = build({ crop, phase, rainy, rainProb, online: s.device_online });
        lastKey = key;
      }
      svg.querySelector("#astre").innerHTML = astre(phase, hour, rainy);
      const soil = m == null ? "#a07a4e" : mix("#cdae78", "#4e3622", (m - 12) / 50);
      svg.querySelector("#soil-layer").setAttribute("fill", soil);
    }
    renderMonitor(s, r);
    window.renderIrrigationAnim?.(s);
    el.classList.toggle("pumping", !!s.pump.on);
    el.classList.toggle("dry", m != null && m < threshold);
    el.classList.toggle("wet", m != null && m > target + 15);
    el.dataset.phase = phase;
    el.classList.toggle("rainy", rainy);

    const names = { nuit: "Nuit", aube: "Lever du jour", jour: "Journée", soir: "Fin de journée" };
    document.getElementById("tag-time").textContent = `${now.toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" })} · ${names[phase]}`;
    const tp = document.getElementById("tag-pump");
    tp.textContent = s.pump.on ? "Irrigation en cours" : m != null && m < threshold ? "Sol sec" : "Pompe au repos";
    tp.classList.toggle("on", !!s.pump.on);
    const c = w.current || {};
    document.getElementById("tag-sky").textContent = rainy ? "Il pleut"
      : !w.available ? "Météo indisponible"
      : rainProb >= 50 ? `Pluie probable (${rainProb} %) · ${Math.round(c.temperature_2m)} °C`
      : `${rainProb > 20 ? "Quelques nuages" : "Ciel dégagé"} · ${Math.round(c.temperature_2m)} °C`;
  };
})();
