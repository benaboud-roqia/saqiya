/* Sāqiya — logique du tableau de bord */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 1) => (v === null || v === undefined || Number.isNaN(+v) ? "—" : (+v).toFixed(d).replace(".", ","));
const hm = (ts) => new Date(ts * 1000).toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" });
const dayHm = (ts) => new Date(ts * 1000).toLocaleString(LOC(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const NS = "http://www.w3.org/2000/svg";

const state = { status: null, kb: null, rows: [], range: 24, durMin: 5, tick: 0 };

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { location.replace("/login?next=/app/"); throw new Error("connexion requise"); }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ================= navigation ================= */
function show(view) {
  $$(".nav").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  document.body.dataset.view = view;
  if (view === "chat") loadChat();
  if (view === "history") loadEvents();
  if (view === "settings") loadSettings();
  if (view === "analytics") window.loadAnalytics?.();
  if (view === "photos") window.loadPhotos?.();
  if (view === "device") window.loadDevice?.();
  if (view === "overview") { state.animateChart = true; drawChart(); drawSensor(); }
  window.scrollTo({ top: 0 });
  observeReveal();
}

/* apparition progressive des panneaux au défilement */
const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("seen"); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.08 }) : null;
function observeReveal() {
  if (!revealObserver) return;
  $$(".view.active .panel, .view.active .scene, .view.active .kpi").forEach((el, i) => {
    if (el.dataset.revealed) return;
    el.dataset.revealed = "1";
    el.classList.add("reveal");
    el.style.transitionDelay = Math.min(i, 6) * 60 + "ms";
    revealObserver.observe(el);
  });
}
window.observeReveal = observeReveal;
$$(".nav").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

/* ================= en-tête ================= */
function renderHeader(s) {
  const d = new Date();
  $("#today").textContent = d.toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" }) + " · " + d.toLocaleTimeString(LOC(), { hour: "2-digit", minute: "2-digit" });
  const m = /^(.*?)\s*\((.*)\)$/.exec(s.crop.label) || [null, s.crop.label, ""];
  $("#crop-name").textContent = m[1];
  $("#crop-ar").textContent = m[2];
  const soilLabel = state.kb?.soil_types?.[s.settings.soil_type] || s.settings.soil_type;
  $("#soil-name").textContent = "Sol " + soilLabel.replace(/\s*\(.*\)/, "").toLowerCase();
  const c = s.weather?.current;
  $("#weather-now").textContent = s.weather?.available && c ? `Dehors ${num(c.temperature_2m, 0)} °C, ${num(c.relative_humidity_2m, 0)} % d'humidité` : "Prévisions indisponibles";
  $$(".mode button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === s.settings.mode)));

  renderBanner(s);
  const online = s.device_online;
  $("#device-dot").className = "dot " + (online ? "on" : "off");
  $("#device-label").textContent = online ? "Capteur connecté" : "Capteur hors ligne";
  $("#device-seen").textContent = s.latest_reading ? "Dernier relevé " + hm(s.latest_reading.ts) : "Aucun relevé";
}

/* bannière : photo de la culture (Unsplash, licence libre) + mesures en direct */
const CROP_PHOTOS = {
  tomate: "photo-1758552219061-5148ccb5bc5d", olivier: "photo-1785440944109-4021897d9e13",
  ble: "photo-1647432460909-153f77f1630f", pomme_de_terre: "photo-1640677117376-573b9dbb8ea8",
  poivron: "photo-1524486361537-8ad15938e1a3", fraise: "photo-1524486361537-8ad15938e1a3",
  agrumes: "photo-1524486361537-8ad15938e1a3", vigne: "photo-1738598665806-7ecc32c3594c",
};
let bannerCrop = null, bannerSig = "";
function renderBanner(s) {
  const crop = s.settings.crop;
  if (crop !== bannerCrop) {
    bannerCrop = crop;
    const id = CROP_PHOTOS[crop] || "photo-1748432171507-c1d62fe2e859";
    const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&h=600&q=70`;
    const el = $("#hb-photo");
    const img = new Image();
    img.onload = () => { el.style.opacity = 0; setTimeout(() => { el.style.backgroundImage = `url("${url}")`; el.style.opacity = 1; }, el.style.backgroundImage ? 400 : 0); };
    img.src = url;
  }
  const r = s.latest_reading || {}, th = s.thresholds, w = s.weather || {};
  const dry = r.soil_moisture != null && r.soil_moisture < th.threshold;
  const chips = [
    [`Sol`, `${num(r.soil_moisture)} %`, dry ? "warn" : ""],
    [`Air`, `${num(r.air_temp)} °C`, ""],
    [`Pompe`, s.pump.on ? "en marche" : "arrêtée", s.pump.on ? "on" : ""],
    [`Pluie 12 h`, w.available ? `${num(w.rain_next_12h_mm)} mm` : "—", ""],
  ];
  const sig = chips.map((c) => c.join("|")).join(";");
  if (sig === bannerSig) return;
  const first = !bannerSig;
  bannerSig = sig;
  $("#hb-stats").innerHTML = chips.map(([l, v, c]) => `<span class="${c}" style="${first ? "" : "animation:none"}">${l} <b>${v}</b></span>`).join("");
}

$$(".mode button").forEach((b) => b.addEventListener("click", async () => {
  if (state.status?.settings.mode === b.dataset.mode) return;
  await api("/api/settings", { method: "PUT", body: JSON.stringify({ mode: b.dataset.mode }) });
  toast(b.dataset.mode === "auto" ? "Mode automatique activé" : "Mode manuel : la pompe n'agit que sur votre ordre");
  refresh();
}));

/* ================= jauge ================= */
function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arc(cx, cy, r, v0, v1) {
  const a0 = -210 + 2.4 * v0, a1 = -210 + 2.4 * Math.max(v0 + 0.01, v1);
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}
/* l'aiguille de la jauge glisse vers la nouvelle valeur, le chiffre défile */
let gaugeAnim = null;
function renderGauge(s) {
  const to = s.latest_reading?.soil_moisture;
  if (to == null) { state.gv = null; return drawGauge(s, null); }
  const from = state.gv ?? 0;
  if (Math.abs(from - to) < 0.05) return drawGauge(s, to);
  cancelAnimationFrame(gaugeAnim);
  drawGauge(s, from);   // dessin immédiat, même si l'onglet est en arrière-plan (pas d'animation dans ce cas)
  if (document.hidden) { state.gv = to; return drawGauge(s, to); }
  const t0 = performance.now(), dur = state.gv == null ? 1400 : 700;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    state.gv = from + (to - from) * e;
    drawGauge(s, state.gv);
    if (k < 1) gaugeAnim = requestAnimationFrame(step);
  };
  gaugeAnim = requestAnimationFrame(step);
}
function drawGauge(s, m) {
  // réservoir de sol : l'eau monte et descend selon l'humidité (échelle 0–80 %, au-delà le sol est saturé)
  const { threshold: th, target: tg } = s.thresholds;
  const SCALE = 80;
  const pos = (v) => Math.max(0, Math.min(100, (v / SCALE) * 100));
  const wetFrom = Math.min(SCALE, tg + 15);
  const wrap = $("#tank-wrap");
  const state = m == null ? "wait" : m < th ? "dry" : m > wetFrom ? "wet" : "ok";
  wrap.dataset.state = state;
  wrap.classList.toggle("pumping", !!s.pump?.on);
  $("#tank").style.setProperty("--level", pos(m ?? 0) + "%");
  $("#tank-thr").style.bottom = pos(th) + "%";
  $("#tank-tgt").style.bottom = pos(tg) + "%";
  $("#tank-zone").style.cssText = `bottom:${pos(th)}%;height:${pos(tg) - pos(th)}%`;
  $("#t-thr").textContent = `${num(th, 0)} %`;
  $("#t-tgt").textContent = `${num(tg, 0)} %`;
  $("#gauge-value").textContent = m == null ? "—" : num(m);
  const labels = { wait: "En attente du capteur", dry: "Sol sec", ok: "Bonne humidité", wet: "Sol trop humide" };
  $("#gauge-state").textContent = labels[state];
  const tip = $("#tank-tip");
  if (state === "wait") tip.textContent = "";
  else if (s.pump?.on) tip.textContent = "Arrosage en cours : l'eau remonte.";
  else if (state === "dry") tip.textContent = `Il manque environ ${Math.max(1, Math.round(tg - m))} points pour atteindre l'objectif.`;
  else if (state === "wet") tip.textContent = "Le sol a trop d'eau : aucun arrosage.";
  else tip.textContent = "Rien à faire : le sol a assez d'eau.";
  $("#gauge-range").textContent = `idéal ${num(th, 0)}–${num(tg, 0)} %`;
}

/* ================= irrigation ================= */
function decisionText(s) {
  const p = s.pump, d = s.irrigation_decision, th = s.thresholds;
  if (p.on && p.mode === "manuel") return "Arrosage manuel en cours.";
  if (p.on) return `Le sol est passé sous ${num(th.threshold, 0)} %. Arrosage en cours jusqu'à ${num(th.target, 0)} %.`;
  if (s.settings.mode === "manuel") return "Mode manuel : la pompe ne démarre que sur votre ordre.";
  if (!s.latest_reading) return "En attente des premières mesures du capteur.";
  if (d.action === "attente") return "Le sol est assez humide. Pas besoin d'arroser pour le moment.";
  return d.reason;
}
function renderPump(s) {
  const p = s.pump;
  const tag = $("#pump-tag");
  tag.textContent = p.on ? "Pompe en marche" : "Pompe arrêtée";
  tag.classList.toggle("on", p.on);
  $(".pump-panel").classList.toggle("pumping", !!p.on);
  $("#decision").textContent = decisionText(s);

  const n = s.next_irrigation;
  $("#next-irr").textContent = p.on ? "maintenant"
    : n.available && n.hours === 0 ? "dès que possible"
    : n.available && n.hours != null ? (n.hours < 1 ? `dans ${Math.round(n.hours * 60)} min` : n.hours > 48 ? "> 2 jours" : `dans ${num(n.hours)} h`)
    : "pas prévu";
  const w = s.water_24h;
  $("#water-24").textContent = `${w.n} × · ${Math.round(w.total_s / 60)} min`;
  $("#calib").textContent = `${num(s.settings.sec_per_percent)} s / %`;

  $("#pump-progress").hidden = !p.on;
  if (p.on) {
    const total = p.running_for_s + p.seconds_remaining || 1;
    $("#pump-bar").style.width = (100 * p.running_for_s / total) + "%";
    const mm = Math.floor(p.seconds_remaining / 60), ss = String(p.seconds_remaining % 60).padStart(2, "0");
    $("#pump-left").textContent = `${mm}:${ss} restant`;
  }
  $("#btn-on").hidden = p.on;
  $("#btn-off").hidden = !p.on;
  $(".stepper").hidden = p.on;
}
$$(".stepper button").forEach((b) => b.addEventListener("click", () => {
  state.durMin = Math.max(1, Math.min(15, state.durMin + +b.dataset.step));
  $("#dur-out").textContent = state.durMin + " min";
}));
$("#btn-on").addEventListener("click", async () => {
  await api("/api/pump", { method: "POST", body: JSON.stringify({ action: "on", duration_s: state.durMin * 60 }) });
  toast(`Arrosage lancé pour ${state.durMin} min`);
  refresh();
});
$("#btn-off").addEventListener("click", async () => {
  await api("/api/pump", { method: "POST", body: JSON.stringify({ action: "off" }) });
  toast("Pompe arrêtée");
  refresh();
});

/* ================= prévisions ================= */
async function renderForecast(s) {
  if (!s.weather?.available) {
    $("#forecast").innerHTML = `<p class="hint" style="grid-column:1/-1;margin:0">Pas de connexion au service météo. L'arrosage s'appuie sur le capteur de pluie.</p>`;
    $("#forecast-sum").textContent = "";
    return;
  }
  const w = await api("/api/weather").catch(() => null);
  const hours = (w?.hourly || []).slice(0, 12);
  const mm = s.weather.rain_next_12h_mm;
  $("#forecast-sum").textContent = mm > 0 ? `${num(mm)} mm de pluie attendus` : "Pas de pluie attendue";
  $("#forecast").innerHTML = hours.map((h, i) => `
    <div class="fh ${i === 0 ? "now" : ""}" title="${esc(h.rain_mm)} mm · ${esc(h.rain_prob)} %">
      <span class="p ${h.rain_prob >= 50 ? "wet" : ""}">${h.rain_prob} %</span>
      <span class="col"><div style="height:${Math.max(0, h.rain_prob)}%"></div></span>
      <span class="t">${num(h.temp, 0)}°</span>
      <span class="h">${i === 0 ? "Maint." : esc(h.time.slice(11, 13)) + " h"}</span>
    </div>`).join("");
}

/* ================= relevés ================= */
const READOUTS = [
  { k: "soil_temp", label: "Température du sol", unit: "°C", d: 1 },
  { k: "soil_ph", label: "pH du sol", unit: "", d: 1, note: (v, s) => v < s.crop.ph[0] || v > s.crop.ph[1] ? [`hors plage ${s.crop.ph[0]}–${s.crop.ph[1]}`, true] : [`plage ${s.crop.ph[0]}–${s.crop.ph[1]}`] },
  { k: "soil_ec", label: "Salinité", unit: "dS/m", d: 2, note: (v, s) => v > s.crop.ec_max ? [`${num(v * 1000, 0)} µS/cm · au-dessus de ${num(s.crop.ec_max, 1)}`, true] : [`${num(v * 1000, 0)} µS/cm · max. ${num(s.crop.ec_max, 1)}`] },
  { k: "n", label: "Azote (N)", unit: "mg/kg", d: 0, note: (v) => nutNote("N", v) },
  { k: "p", label: "Phosphore (P)", unit: "mg/kg", d: 0, note: (v) => nutNote("P", v) },
  { k: "k", label: "Potassium (K)", unit: "mg/kg", d: 0, note: (v) => nutNote("K", v) },
  { k: "air_temp", label: "Température de l'air", unit: "°C", d: 1, note: (v, s, r) => r.air_source === "meteo" ? ["météo du lieu"] : [""] },
  { k: "air_humidity", label: "Humidité de l'air", unit: "%", d: 0, note: (v, s, r) => v >= 90 ? ["feuillage humide", true] : [r.air_source === "meteo" ? "météo du lieu" : ""] },
  { k: "rain_detected", label: "Pluie", fmt: (v) => (v ? "Oui" : "Non"), noSpark: true, optional: true },
];
function nutNote(K, v) {
  const [lo, hi] = nutRange(K);
  return v < lo ? [`bas (idéal ${lo}–${hi})`, true] : v > hi ? [`élevé (idéal ${lo}–${hi})`, true] : [`bon (idéal ${lo}–${hi})`];
}
function spark(key) {
  const since = Date.now() / 1000 - 6 * 3600;
  const pts = state.rows.filter((r) => r.ts >= since && r[key] != null);
  if (pts.length < 2) return "";
  const step = Math.ceil(pts.length / 40);
  // moyenne par paquet : la courbe montre la tendance, pas le bruit du capteur
  const p = [];
  for (let i = 0; i < pts.length; i += step) {
    const g = pts.slice(i, i + step);
    p.push({ ts: g[g.length - 1].ts, [key]: g.reduce((a, r) => a + r[key], 0) / g.length });
  }
  if (p.length < 2) return "";
  const vs = p.map((r) => r[key]);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const span = (SENSOR.find((o) => o.k === key) || { span: { air_temp: 4, air_humidity: 10 }[key] || 1 }).span;
  if (hi - lo < span) { const m = (hi + lo) / 2; lo = m - span / 2; hi = m + span / 2; }
  const t0 = p[0].ts, t1 = p[p.length - 1].ts;
  const X = (t) => 2 + ((t - t0) / Math.max(1, t1 - t0)) * 86, Y = (v) => 30 - ((v - lo) / (hi - lo)) * 26;
  const d = p.map((r, i) => `${i ? "L" : "M"}${X(r.ts).toFixed(1)},${Y(r[key]).toFixed(1)}`).join("");
  const last = p[p.length - 1];
  return `<svg class="spark" viewBox="0 0 92 34" aria-hidden="true"><path d="${d}"/><circle cx="${X(last.ts)}" cy="${Y(last[key])}" r="2.2"/></svg>`;
}
function renderReadouts(s) {
  const r = s.latest_reading || {};
  $("#readings-time").textContent = r.ts ? "relevé de " + hm(r.ts) + " · courbes sur 6 h" : "—";
  $("#readouts").innerHTML = READOUTS.filter((o) => !(o.optional && r[o.k] == null)).map((o) => {
    const v = r[o.k];
    const shown = v == null ? "—" : o.fmt ? o.fmt(v) : num(v, o.d);
    const [note, warn] = v != null && o.note ? o.note(v, s, r) : [""];
    return `<div class="ro">
      <span class="lbl">${o.label}</span>
      <span class="v">${shown}${o.unit && v != null ? `<small>${o.unit}</small>` : ""}</span>
      <span class="note ${warn ? "warn" : ""}">${esc(note)}</span>
      ${o.noSpark ? "" : spark(o.k)}
    </div>`;
  }).join("");
}

/* ================= graphique ================= */
async function loadRows() {
  state.rows = await api(`/api/readings?hours=${Math.max(state.range, 6)}`).catch(() => state.rows);
}
function drawChart() {
  const el = $("#chart"), tip = $("#chart-tip");
  const since = Date.now() / 1000 - state.range * 3600;
  const rows = state.rows.filter((r) => r.ts >= since);
  el.querySelector("svg")?.remove();
  el.querySelector(".empty")?.remove();
  if (rows.length < 2 || !el.clientWidth) {
    el.insertAdjacentHTML("afterbegin", `<div class="empty">Les courbes apparaîtront après quelques relevés.</div>`);
    return;
  }
  const step = Math.ceil(rows.length / 500);
  const data = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  const W = el.clientWidth, H = el.clientHeight, L = 38, R = 38, T = 10, B = 26;
  const t0 = data[0].ts, t1 = data[data.length - 1].ts;
  const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const YP = (v) => T + (1 - v / 100) * (H - T - B);
  const temps = data.map((r) => r.air_temp).filter((v) => v != null);
  const tMin = Math.floor(Math.min(...temps, 10) / 5) * 5, tMax = Math.ceil(Math.max(...temps, 35) / 5) * 5;
  const YT = (v) => T + (1 - (v - tMin) / (tMax - tMin)) * (H - T - B);
  const path = (k, Y) => data.filter((r) => r[k] != null).map((r, i) => `${i ? "L" : "M"}${X(r.ts).toFixed(1)},${Y(r[k]).toFixed(1)}`).join("");

  let bands = "", start = null;
  data.forEach((r, i) => {
    if (r.pump_on && start === null) start = r.ts;
    if ((!r.pump_on || i === data.length - 1) && start !== null) {
      bands += `<rect x="${X(start)}" y="${T}" width="${Math.max(2, X(r.ts) - X(start))}" height="${H - T - B}" fill="var(--pump-band)"/>`;
      start = null;
    }
  });
  let grid = "";
  for (let v = 0; v <= 100; v += 25) grid += `<line class="gl" x1="${L}" x2="${W - R}" y1="${YP(v)}" y2="${YP(v)}"/><text class="ax" x="${L - 8}" y="${YP(v) + 3.5}" text-anchor="end">${v}%</text>`;
  for (let i = 0; i <= 4; i++) { const v = tMin + ((tMax - tMin) * i) / 4; grid += `<text class="ax" x="${W - R + 8}" y="${YT(v) + 3.5}">${v.toFixed(0)}°</text>`; }
  const ticks = Math.max(2, Math.min(6, Math.floor((W - L - R) / 110)));
  for (let i = 0; i <= ticks; i++) {
    const t = t0 + ((t1 - t0) * i) / ticks;
    const lab = state.range > 24 ? dayHm(t) : hm(t);
    grid += `<text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}">${lab}</text>`;
  }
  const th = state.status?.thresholds?.threshold;
  const thLine = th ? `<line x1="${L}" x2="${W - R}" y1="${YP(th)}" y2="${YP(th)}" stroke="var(--clay)" stroke-dasharray="4 4" stroke-width="1"/><text class="ax" x="${W - R - 4}" y="${YP(th) - 5}" text-anchor="end" style="fill:var(--clay)">seuil d'arrosage</text>` : "";

  el.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des relevés">
    ${bands}${grid}${thLine}
    <path d="${path("air_humidity", YP)}" fill="none" stroke="var(--ink-3)" stroke-width="1.3"/>
    <path d="${path("air_temp", YT)}" fill="none" stroke="var(--clay)" stroke-width="1.4"/>
    <path d="${path("soil_moisture", YP)}" fill="none" stroke="var(--water)" stroke-width="2.4" stroke-linejoin="round"/>
    <line class="xh" id="xh" y1="${T}" y2="${H - B}" visibility="hidden"/>
  </svg>`);
  if (state.animateChart) {
    state.animateChart = false;
    el.querySelectorAll("svg > path").forEach((p) => {
      p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1);
      p.classList.add("draw");
    });
  }

  const svg = el.querySelector("svg"), xh = svg.querySelector("#xh");
  svg.addEventListener("mousemove", (e) => {
    const box = svg.getBoundingClientRect();
    const mx = e.clientX - box.left;
    if (mx < L || mx > W - R) { xh.setAttribute("visibility", "hidden"); tip.hidden = true; return; }
    const t = t0 + ((mx - L) / (W - L - R)) * (t1 - t0);
    let best = data[0];
    for (const r of data) if (Math.abs(r.ts - t) < Math.abs(best.ts - t)) best = r;
    const x = X(best.ts);
    xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${dayHm(best.ts)}</b>sol ${num(best.soil_moisture)} %<br>air ${num(best.air_humidity, 0)} % · ${num(best.air_temp)} °C${best.pump_on ? "<br>pompe en marche" : ""}`;
    tip.hidden = false;
    tip.style.left = Math.min(x + 12, W - tip.offsetWidth - 4) + "px";
  });
  svg.addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
$$("#range button").forEach((b) => b.addEventListener("click", async () => {
  $$("#range button").forEach((x) => x.classList.toggle("on", x === b));
  state.range = +b.dataset.h;
  state.animateChart = true;
  await loadRows();
  drawChart();
  drawSensor();
}));
let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { drawChart(); drawSensor(); }, 150); });

/* ================= capteur du sol : une courbe par mesure ================= */
const SENSOR = [
  { k: "soil_moisture", label: "Humidité", unit: "%", d: 1, c: "var(--water)", span: 6, zone: (s) => [s.thresholds?.threshold, s.thresholds?.target] },
  { k: "soil_temp", label: "T° du sol", unit: "°C", d: 1, c: "var(--clay)", span: 3, zone: () => [12, 30] },
  { k: "soil_ph", label: "pH", unit: "", d: 1, c: "#8b6fd6", span: 0.6, zone: (s) => s.crop?.ph },
  { k: "soil_ec", label: "Salinité EC", unit: "dS/m", d: 2, c: "var(--ochre)", span: 0.3, zone: (s) => [0, s.crop?.ec_max] },
  { k: "n", label: "Azote N", unit: "mg/kg", d: 0, c: "#3f9d5a", span: 12, zone: () => nutRange("N") },
  { k: "p", label: "Phosphore P", unit: "mg/kg", d: 0, c: "#c77d2e", span: 12, zone: () => nutRange("P") },
  { k: "k", label: "Potassium K", unit: "mg/kg", d: 0, c: "#4a7fc1", span: 30, zone: () => nutRange("K") },
];
function nutRange(K) {
  const n = state.kb?.nutrients?.[K] || { N: { low: 20, high: 60 }, P: { low: 15, high: 50 }, K: { low: 120, high: 300 } }[K];
  return [n.low, n.high];
}
// verdict « bas / bon / élevé » d'une valeur par rapport à sa zone idéale
function verdict(o, v, s) {
  const [lo, hi] = o.zone(s) || [];
  if (v == null || lo == null || hi == null) return ["", "na"];
  if (v < lo) return [o.k === "soil_moisture" ? "sec" : "bas", "low"];
  if (v > hi) return [o.k === "soil_ec" ? "trop salé" : o.k === "soil_moisture" ? "très humide" : "élevé", "high"];
  return ["bon niveau", "ok"];
}
state.sensorKey = "soil_ph";
try { state.sensorKey = localStorage.getItem("saqiya-sensor") || "soil_ph"; } catch { /* préférence non disponible */ }
function renderSensorTabs(s) {
  const r = s.latest_reading || {};
  const avail = SENSOR.filter((o) => r[o.k] != null || state.rows.some((x) => x[o.k] != null));
  const panel = $(".sensor-panel");
  panel.hidden = !avail.length;
  if (!avail.length) return;
  if (!avail.some((o) => o.k === state.sensorKey)) state.sensorKey = avail[0].k;
  $("#sx-tabs").innerHTML = avail.map((o) => `<button role="tab" data-k="${o.k}" style="--c:${o.c}" aria-selected="${o.k === state.sensorKey}">
      <i></i>${o.label} <b>${r[o.k] != null ? num(r[o.k], o.d) : "—"}</b></button>`).join("");
  const o = SENSOR.find((x) => x.k === state.sensorKey), v = r[o.k];
  const [vt, vc] = verdict(o, v, s);
  const z = o.zone(s) || [];
  const vals = state.rows.filter((x) => x[o.k] != null && x.ts >= Date.now() / 1000 - 86400).map((x) => x[o.k]);
  const AR = window.LANG === "ar";
  $("#sx-now").innerHTML = `
    <span class="lbl">${o.label} · ${AR ? "الآن" : "maintenant"}</span>
    <span class="big" dir="ltr">${v != null ? num(v, o.d) : "—"}${o.unit ? `<small>${o.unit}</small>` : ""}</span>
    ${vt ? `<span class="verdict ${vc}">${vt}</span>` : ""}
    <span class="mm" data-noi18n>${z[0] != null && z[1] != null ? `${AR ? "المثالي" : "idéal"} <b dir="ltr">${num(z[0], o.d)} – ${num(z[1], o.d)}</b><br>` : ""}${vals.length ? `${AR ? "خلال 24 ساعة: أدنى" : "sur 24 h : min"} <b>${num(Math.min(...vals), o.d)}</b> · ${AR ? "أعلى" : "max"} <b>${num(Math.max(...vals), o.d)}</b>` : ""}</span>`;
}
$("#sx-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-k]");
  if (!b) return;
  state.sensorKey = b.dataset.k;
  try { localStorage.setItem("saqiya-sensor", state.sensorKey); } catch { /* préférence non disponible */ }
  if (state.status) renderSensorTabs(state.status);
  state.animateSensor = true;
  drawSensor();
});
function drawSensor() {
  const el = $("#sx-chart"), tip = $("#sx-tip");
  if (!el || !state.status) return;
  const o = SENSOR.find((x) => x.k === state.sensorKey) || SENSOR[2];
  const since = Date.now() / 1000 - state.range * 3600;
  const rows = state.rows.filter((r) => r.ts >= since && r[o.k] != null);
  el.querySelector("svg")?.remove();
  el.querySelector(".empty")?.remove();
  if (rows.length < 2 || !el.clientWidth) {
    el.insertAdjacentHTML("afterbegin", `<div class="empty">La courbe apparaîtra après quelques mesures du capteur.</div>`);
    return;
  }
  // moyenne glissante par paquets : on voit la tendance du sol, pas le bruit de mesure
  const step = Math.max(1, Math.ceil(rows.length / 120));
  const data = [];
  for (let i = 0; i < rows.length; i += step) {
    const g = rows.slice(i, i + step);
    data.push({ ts: g[g.length - 1].ts, [o.k]: g.reduce((a, r) => a + r[o.k], 0) / g.length });
  }
  data[data.length - 1][o.k] = rows[rows.length - 1][o.k];   // le dernier point = la vraie dernière mesure
  if (data.length < 2) { el.insertAdjacentHTML("afterbegin", `<div class="empty">La courbe apparaîtra après quelques mesures du capteur.</div>`); return; }
  const W = el.clientWidth, H = el.clientHeight, L = 46, R = 14, T = 12, B = 26;
  const t0 = data[0].ts, t1 = data[data.length - 1].ts;
  const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const [zl, zh] = o.zone(state.status) || [];
  const vs = data.map((r) => r[o.k]);
  // échelle : englobe les mesures et la zone idéale, avec une amplitude minimale (les petits écarts restent petits)
  let lo = Math.min(...vs, zl ?? Infinity), hi = Math.max(...vs, zh ?? -Infinity);
  if (hi - lo < o.span) { const m = (hi + lo) / 2; lo = m - o.span / 2; hi = m + o.span / 2; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  if (o.k !== "soil_temp") lo = Math.max(0, lo);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = data.map((r, i) => `${i ? "L" : "M"}${X(r.ts).toFixed(1)},${Y(r[o.k]).toFixed(1)}`).join("");
  const area = `${line}L${X(t1).toFixed(1)},${H - B}L${X(t0).toFixed(1)},${H - B}Z`;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    grid += `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 3.5}" text-anchor="end">${num(v, o.d > 0 ? o.d : 0)}</text>`;
  }
  const ticks = Math.max(2, Math.min(6, Math.floor((W - L - R) / 110)));
  for (let i = 0; i <= ticks; i++) {
    const t = t0 + ((t1 - t0) * i) / ticks;
    grid += `<text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}">${state.range > 24 ? dayHm(t) : hm(t)}</text>`;
  }
  let zone = "";
  if (zl != null && zh != null) {
    const y1 = Y(Math.min(hi, zh)), y2 = Y(Math.max(lo, zl));
    if (y2 > y1) zone = `<rect class="zone" x="${L}" y="${y1}" width="${W - L - R}" height="${y2 - y1}"/>
      <line class="zone-l" x1="${L}" x2="${W - R}" y1="${y1}" y2="${y1}"/><line class="zone-l" x1="${L}" x2="${W - R}" y1="${y2}" y2="${y2}"/>`;
  }
  const last = data[data.length - 1];
  el.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label}">
    <defs><linearGradient id="sxg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${o.c}"/><stop offset="1" stop-color="${o.c}" stop-opacity="0"/></linearGradient></defs>
    ${zone}${grid}
    <path class="area" d="${area}" fill="url(#sxg)"/>
    <path class="line" d="${line}" stroke="${o.c}"/>
    <circle class="now" cx="${X(last.ts)}" cy="${Y(last[o.k])}" r="5" fill="${o.c}"/>
    <line class="xh" y1="${T}" y2="${H - B}" visibility="hidden"/>
  </svg>`);
  if (state.animateSensor || state.animateChart) {
    state.animateSensor = false;
    const p = el.querySelector(".line");
    p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1);
    p.classList.add("draw");
  }
  const svg = el.querySelector("svg"), xh = svg.querySelector(".xh");
  svg.addEventListener("mousemove", (e) => {
    const mx = e.clientX - svg.getBoundingClientRect().left;
    if (mx < L || mx > W - R) { xh.setAttribute("visibility", "hidden"); tip.hidden = true; return; }
    const t = t0 + ((mx - L) / (W - L - R)) * (t1 - t0);
    let best = data[0];
    for (const r of data) if (Math.abs(r.ts - t) < Math.abs(best.ts - t)) best = r;
    const x = X(best.ts);
    xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${dayHm(best.ts)}</b>${o.label} ${num(best[o.k], o.d)} ${o.unit}`;
    tip.hidden = false;
    tip.style.left = Math.min(x + 12, W - tip.offsetWidth - 4) + "px";
  });
  svg.addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; });
}

/* ================= santé des plantes ================= */
function renderHealth(s) {
  const d = s.disease;
  if (!d?.available) { $("#diseases").innerHTML = `<p class="hint">${esc(d?.message || "En attente des relevés.")}</p>`; return; }
  const open = new Set($$("#diseases details[open]").map((x) => x.dataset.k));
  const watch = d.risks.filter((r) => r.level !== "faible").length;
  $("#health-sum").textContent = watch ? `${watch} risque${watch > 1 ? "s" : ""} à surveiller` : "Aucun risque notable";
  $("#diseases").innerHTML = d.risks.map((r) => {
    const [fr, ar] = (/^(.*?)\s*\((.*)\)$/.exec(r.label) || [null, r.label, ""]).slice(1);
    return `<details class="dz lv-${r.level}" data-k="${esc(r.disease)}" ${open.has(r.disease) ? "open" : ""}>
      <summary>
        <span class="name">${esc(fr)}<span lang="ar">${esc(ar)}</span></span>
        <span class="pct">${num(r.risk, 0)} %</span>
        <span class="meter"><div style="width:${Math.max(1, r.risk)}%"></div></span>
      </summary>
      <div class="body">
        <p><b>Quand elle apparaît.</b> ${esc(r.conditions)}</p>
        <p><b>Prévenir.</b> ${esc(r.prevention)}</p>
        <p><b>Traiter.</b> ${esc(r.treatment)}</p>
      </div>
    </details>`;
  }).join("");
  const f = d.features;
  $("#model-foot").textContent = `Calculé sur les dernières heures : ${num(f.temp)} °C en moyenne, ${num(f.rh, 0)} % d'humidité, feuillage humide ~${num(f.wet_hours, 0)} h sur 24 h.`;
}

/* ================= sol ================= */
function lane(value, lo, hi, max) {
  const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="lane"><span class="ok-zone" style="left:${pct(lo)}%;width:${pct(hi) - pct(lo)}%"></span>${value != null ? `<span class="pin" style="left:${pct(value)}%"></span>` : ""}</div>`;
}
function renderSoil(s) {
  const r = s.latest_reading;
  if (!r) { $("#soil").innerHTML = `<p class="hint">En attente des relevés.</p>`; return; }
  const [lo, hi] = s.crop.ph, P = (v) => ((Math.max(4, Math.min(9, v)) - 4) / 5) * 100;
  const nut = state.kb?.nutrients || { N: { low: 20, high: 60 }, P: { low: 15, high: 50 }, K: { low: 120, high: 300 } };
  const maxOf = { N: 100, P: 80, K: 400 };
  const field = { N: "n", P: "p", K: "k" };
  const bad = (s.soil_advice || []).filter((a) => a.status !== "ok");
  $("#soil").innerHTML = `
    <div class="soil-block">
      <div class="soil-top"><b>pH</b><span class="v">${num(r.soil_ph)}</span></div>
      <div class="ph-scale">
        <span class="ph-ideal" style="left:${P(lo)}%;width:${P(hi) - P(lo)}%"></span>
        ${r.soil_ph != null ? `<span class="ph-pin" style="left:${P(r.soil_ph)}%"></span>` : ""}
      </div>
      <div class="ph-axis"><span>4 acide</span><span>5</span><span>6</span><span>7 neutre</span><span>8</span><span>9 alcalin</span></div>
    </div>
    <div class="soil-block">
      <div class="soil-top"><b>Éléments nutritifs</b><span class="hint">mg/kg · zone verte = bon niveau</span></div>
      <div class="npk">
        ${["N", "P", "K"].map((k) => {
          const v = r[field[k]];
          return `<div class="nut"><span class="k">${k}</span>${lane(v, nut[k].low, nut[k].high, maxOf[k])}<span class="val ${v != null && v < nut[k].low ? "low" : ""}">${num(v, 0)}</span></div>`;
        }).join("")}
      </div>
      ${bad.length ? bad.map((a) => `<p class="advice"><b>${esc(a.message)}</b> ${esc(a.action || "")}</p>`).join("")
        : `<p class="allgood">pH, salinité et nutriments sont au bon niveau. Un engrais d'entretien suffit.</p>`}
    </div>`;
}

/* ================= alertes ================= */
async function renderAlerts() {
  const alerts = await api("/api/alerts?limit=20").catch(() => []);
  const open = alerts.filter((a) => !a.ack).length;
  $("#alert-count").textContent = open ? `${open} à lire` : "tout est lu";
  $("#alerts").innerHTML = alerts.length ? alerts.map((a) => `
    <li class="${a.ack ? "done" : ""}">
      <time>${dayHm(a.ts)}</time>
      <div class="what ${a.level === "danger" ? "danger" : ""}"><b>${esc(a.title)}</b><p>${esc(a.message)}</p></div>
      ${a.ack ? "" : `<button class="ack" data-id="${a.id}"><svg><use href="#i-check"/></svg>Lu</button>`}
    </li>`).join("") : `<li class="empty">Rien à signaler.</li>`;
}
$("#alerts").addEventListener("click", async (e) => {
  const b = e.target.closest(".ack");
  if (!b) return;
  await api(`/api/alerts/${b.dataset.id}/ack`, { method: "POST" });
  renderAlerts();
});

/* ================= journal : voir journal.js ================= */

/* ================= conseiller ================= */
// texte simple : retire les symboles de mise en forme (**, #, `…) des anciennes réponses
function plainText(t) {
  return String(t || "")
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1").replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "").replace(/^\s*[*+-]\s+/gm, "• ").replace(/^\s*([-*_=]){3,}\s*$/gm, "")
    .replace(/(\d)\s*\*\s*(\d)/g, "$1 × $2").replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/\*/g, "").replace(/#/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}
function bubble(role, text, ts, source, typed) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.dir = "auto";
  const body = document.createElement("span");
  body.className = "msg-text";
  const clean = role === "user" ? text : plainText(text);
  div.appendChild(body);
  const st = document.createElement("span");
  st.className = "stamp";
  st.textContent = (role === "user" ? "Vous" : "Conseiller") + (ts ? " · " + hm(ts) : "");
  div.appendChild(st);
  $("#chat-log").appendChild(div);
  if (typed && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) typeOut(body, clean, div);
  else body.textContent = clean;
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  return div;
}
// réponse écrite lettre par lettre ; les longues réponses accélèrent (7 s au maximum)
function typeOut(el, text, msg) {
  const chars = Array.from(text), log = $("#chat-log");
  const total = Math.min(7000, Math.max(600, chars.length * 22));   // durée totale : 7 s au maximum
  msg.classList.add("typing-out");
  const t0 = Date.now();
  let shown = 0;
  const stick = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  // basé sur le temps écoulé (et non sur requestAnimationFrame, mis en pause quand l'onglet est en arrière-plan) :
  // la réponse se termine toujours, même si l'utilisateur change d'onglet pendant l'écriture
  const timer = setInterval(() => {
    const i = Math.min(chars.length, Math.ceil(((Date.now() - t0) / total) * chars.length));
    if (i !== shown) {
      const follow = stick();
      shown = i;
      el.textContent = chars.slice(0, i).join("");
      if (follow) log.scrollTop = log.scrollHeight;
    }
    if (i >= chars.length) { clearInterval(timer); msg.classList.remove("typing-out"); }
  }, 30);
}
async function loadChat() {
  const h = await api("/api/chat/history").catch(() => []);
  $("#chat-log").innerHTML = "";
  if (!h.length) bubble("bot", "السلام عليكم. Je suis votre conseiller agricole. Je vois en direct l'humidité du sol, la météo et l'état de vos cultures : posez-moi vos questions en arabe, en darija ou en français.");
  h.forEach((m) => bubble(m.role, m.content, m.ts, m.source));
}
async function send(text) {
  text = text.trim();
  if (!text) return;
  const input = $("#chat-input");
  input.value = ""; input.style.height = "";
  bubble("user", text, Date.now() / 1000);
  const wait = document.createElement("div");
  wait.className = "msg bot";
  wait.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  $("#chat-log").appendChild(wait);
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  $(".send").disabled = true;
  try {
    const r = await api("/api/chat", { method: "POST", body: JSON.stringify({ message: text }) });
    wait.remove();
    bubble("bot", r.reply, Date.now() / 1000, r.source, true);
  } catch (e) {
    wait.remove();
    bubble("bot", "Le message n'a pas pu être envoyé : " + e.message);
  } finally {
    $(".send").disabled = false;
    input.focus();
  }
}
$("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); send($("#chat-input").value); });
$("#chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e.target.value); }
});
$("#chat-input").addEventListener("input", (e) => { e.target.style.height = ""; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; });
$$("#prompts button").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
// nouvelle conversation : l'ancienne reste dans l'historique
$("#chat-clear").addEventListener("click", async () => {
  await api("/api/chat/clear", { method: "POST", body: "{}" });
  await loadChat();
  if (!$("#chat-hist").hidden) loadChatHistory();
  toast("Nouvelle conversation · l'ancienne est dans l'historique");
});

/* historique des conversations du compte */
function chatDay(ts) {
  const d = new Date(ts * 1000), today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Aujourd'hui";
  if (same(d, y)) return "Hier";
  return d.toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" });
}
async function loadChatHistory() {
  const r = await api("/api/chat/conversations").catch(() => ({ conversations: [] }));
  const list = r.conversations || [];
  $("#chat-hist-n").textContent = list.length ? `${list.length} conversation${list.length > 1 ? "s" : ""}` : "";
  if (!list.length) { $("#chat-hist-list").innerHTML = `<li class="ch-empty">Aucune conversation pour l'instant.</li>`; return; }
  let html = "", last = "";
  for (const c of list) {
    const day = chatDay(c.last);
    if (day !== last) { html += `<li class="ch-day">${esc(day)}</li>`; last = day; }
    html += `<li class="ch-item ${c.current ? "on" : ""}" data-conv="${c.conv}">
      <button class="ch-open" type="button"><b dir="auto">${esc(plainText(c.title || "Conversation").slice(0, 80))}</b>
        <small>${hm(c.started)} · ${c.messages} message${c.messages > 1 ? "s" : ""}${c.current ? " · en cours" : ""}</small></button>
      <button class="ch-del" type="button" title="Supprimer" aria-label="Supprimer"><svg><use href="#i-trash"/></svg></button>
    </li>`;
  }
  $("#chat-hist-list").innerHTML = html;
}
$("#chat-hist-btn").addEventListener("click", () => {
  const p = $("#chat-hist"), open = p.hidden;
  p.hidden = !open;
  $("#chat-hist-btn").setAttribute("aria-expanded", String(open));
  if (open) loadChatHistory();
});
$("#chat-hist-list").addEventListener("click", async (e) => {
  const li = e.target.closest(".ch-item");
  if (!li) return;
  const conv = +li.dataset.conv;
  if (e.target.closest(".ch-del")) {
    if (!confirm("Supprimer définitivement cette conversation ?")) return;
    await api("/api/chat/delete", { method: "POST", body: JSON.stringify({ conv }) });
  } else {
    await api("/api/chat/open", { method: "POST", body: JSON.stringify({ conv }) });
  }
  await loadChat();
  loadChatHistory();
});

/* ================= réglages : voir settings.js ================= */

/* ================= thèmes ================= */
const THEME_NAMES = { bleu: "Bleu nuit", auto: "Automatique", carnet: "Clair", nuit: "Nuit", oasis: "Oasis", desert: "Désert" };
function currentTheme() { return document.documentElement.dataset.theme || "auto"; }
function markTheme() {
  const t = currentTheme();
  $$("[data-theme-set]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeSet === t)));
}
function setTheme(t) {
  const root = document.documentElement;
  root.classList.add("theme-anim");
  if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
  try { localStorage.setItem("saqiya-theme", t); } catch { /* stockage indisponible : le thème reste pour cette visite */ }
  markTheme();
  setTimeout(() => root.classList.remove("theme-anim"), 500);
  toast("Thème « " + THEME_NAMES[t] + " »");
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-set]");
  if (b) setTheme(b.dataset.themeSet);
});
markTheme();

/* ================= aucun boîtier réel ================= */
let usbTick = 0;
async function renderNoDevice(s) {
  if (!document.body.dataset.view) document.body.dataset.view = "overview";
  const none = !s.has_device;
  const was = document.body.classList.contains("no-device");
  document.body.classList.toggle("no-device", none);
  $("#nodev").hidden = !none;
  if (was && !none) { state.animateChart = true; await loadRows(); drawChart(); drawSensor(); }   // le boîtier vient d'arriver
  if (!none || usbTick++ % 2) return;
  // état de la lecture USB, pour guider l'agriculteur
  const info = await api("/api/device").catch(() => null);
  const u = info?.usb || {}, el = $("#nodev-usb");
  const AR = window.LANG === "ar";
  let txt, cls = "";
  if (!u.available) txt = AR ? "قراءة USB غير مفعلة على هذا الحاسوب." : "Lecture USB inactive sur ce PC (pyserial manquant).";
  else if (u.connected) { txt = AR ? `تم اكتشاف البطاقة على ${u.port}، في انتظار القياسات…` : `Carte détectée sur ${u.port}, en attente des mesures…`; cls = "found"; }
  else if (u.error && /denied|refus|Permission|Access|busy/i.test(u.error)) { txt = AR ? "المنفذ مشغول: أغلق الشاشة التسلسلية في Arduino." : "Port USB occupé : fermez le moniteur série de l'IDE Arduino."; cls = "busy"; }
  else txt = AR ? "في انتظار بطاقة موصولة بـ USB…" : "Recherche d'une carte branchée en USB…";
  el.className = "nodev-usb " + cls;
  el.querySelector("span").textContent = txt;
}
$("#nodev-go").addEventListener("click", () => show("device"));

/* ================= boucle ================= */
async function refresh() {
  try {
    const s = await api("/api/status");
    state.status = s;
    renderNoDevice(s);
    renderHeader(s);
    window.renderScene?.(s);
    renderGauge(s);
    renderPump(s);
    renderHealth(s);
    renderSoil(s);
    $("#advisor-status").textContent = "Disponible · répond en arabe, darija ou français";
    if (state.tick % 6 === 0) {
      await loadRows();
      renderForecast(s);
      renderAlerts();
      if ($("#view-overview").classList.contains("active")) { drawChart(); drawSensor(); }
    }
    renderReadouts(s);
    renderSensorTabs(s);
    state.tick++;
  } catch {
    $("#device-dot").className = "dot off";
    $("#device-label").textContent = "Serveur injoignable";
    $("#device-seen").textContent = "Nouvelle tentative…";
  }
}
(async () => {
  state.kb = await api("/api/knowledge").catch(() => null);
  state.animateChart = true;
  await refresh();
  observeReveal();
  setInterval(refresh, 5000);
})();
