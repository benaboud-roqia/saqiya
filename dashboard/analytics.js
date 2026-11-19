/* Sāqiya — vue Analyses : indicateurs et graphiques animés (SVG fait main). */
(function () {
  const dayLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString(LOC(), window.LANG === "ar" ? { day: "numeric", month: "numeric" } : { weekday: "short", day: "numeric" });
  const lastDays = (n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return out;
  };

  /* --------- outils --------- */
  function countUp(el, to, decimals = 0, suffix = "") {
    const from = 0, t0 = performance.now(), dur = 1100;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.firstChild.nodeValue = num(from + (to - from) * e, decimals);
      if (k < 1) requestAnimationFrame(step);
    };
    el.innerHTML = `0${suffix ? `<small>${suffix}</small>` : ""}`;
    requestAnimationFrame(step);
  }
  function box(el) { return { W: el.clientWidth || 600, H: el.clientHeight || 230 }; }
  function tips(container) {
    let tip = container.querySelector(".vtip");
    if (!tip) { tip = document.createElement("div"); tip.className = "vtip"; tip.hidden = true; container.appendChild(tip); }
    container.onmousemove = (e) => {
      const t = e.target.closest("[data-tip]");
      if (!t) { tip.hidden = true; return; }
      const b = container.getBoundingClientRect();
      tip.innerHTML = t.dataset.tip;
      tip.hidden = false;
      tip.style.left = Math.max(60, Math.min(b.width - 60, e.clientX - b.left)) + "px";
      tip.style.top = (e.clientY - b.top) + "px";
    };
    container.onmouseleave = () => (tip.hidden = true);
  }
  const empty = (el, msg) => (el.innerHTML = `<div class="empty">${msg}</div>`);
  const sparkPath = (vals, w, h) => {
    const v = vals.filter((x) => x != null);
    if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v) || 1;
    return vals.map((x, i) => `${i ? "L" : "M"}${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - ((x ?? lo) - lo) / (hi - lo || 1) * (h - 4)).toFixed(1)}`).join("");
  };

  /* --------- indicateurs --------- */
  function kpis(st, s) {
    const days = lastDays(7);
    const byDay = Object.fromEntries(st.water.map((w) => [w.day, w]));
    const litres = days.map((d) => ((byDay[d]?.seconds || 0) / 60) * st.pump_flow_lpm);
    const total = litres.reduce((a, b) => a + b, 0);
    const count = st.water.reduce((a, w) => a + w.count, 0);
    const moist = st.moisture.map((m) => m.avg);
    const avgM = moist.length ? moist.reduce((a, b) => a + b, 0) / moist.length : null;
    const top = s?.disease?.risks?.[0];
    $("#kpis").innerHTML = `
      <div class="kpi reveal"><div class="l">Eau utilisée · 7 j</div><div class="n" id="k1">0</div><div class="s">≈ ${num(total / 7, 0)} L par jour${st.costs ? ` · ${num(st.costs.total_cost, 2)} ${esc(st.costs.currency)}` : ""}</div><svg class="mini" viewBox="0 0 70 26"><path d="${sparkPath(litres, 70, 26)}"/></svg></div>
      <div class="kpi reveal"><div class="l">Arrosages · 7 j</div><div class="n" id="k2">0</div><div class="s">${num(count / 7)} par jour en moyenne</div></div>
      <div class="kpi reveal"><div class="l">Humidité moyenne du sol</div><div class="n" id="k3">0</div><div class="s">cible ${num(s?.thresholds?.target, 0)} %</div><svg class="mini" viewBox="0 0 70 26"><path d="${sparkPath(moist, 70, 26)}"/></svg></div>
      <div class="kpi reveal"><div class="l">Risque principal</div><div class="n" id="k4">0</div><div class="s">${top ? esc(top.label.replace(/\s*\(.*\)/, "")) : "—"}</div></div>`;
    countUp($("#k1"), total, 0, "L");
    countUp($("#k2"), count, 0);
    if (avgM != null) countUp($("#k3"), avgM, 1, "%"); else $("#k3").textContent = "—";
    if (top) countUp($("#k4"), top.risk, 0, "%"); else $("#k4").textContent = "—";
  }

  /* --------- eau par jour --------- */
  function water(st) {
    const el = $("#viz-water");
    const days = lastDays(7);
    const byDay = Object.fromEntries(st.water.map((w) => [w.day, w]));
    const vals = days.map((d) => ({ d, l: ((byDay[d]?.seconds || 0) / 60) * st.pump_flow_lpm, n: byDay[d]?.count || 0 }));
    $("#water-hint").textContent = `litres estimés · pompe ${num(st.pump_flow_lpm, 0)} L/min`;
    const { W, H } = box(el), L = 36, B = 26, T = 18;
    const max = Math.max(10, ...vals.map((v) => v.l)) * 1.15;
    const bw = (W - L) / vals.length;
    let s = `<defs><linearGradient id="gwater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46b3e6"/><stop offset="1" style="stop-color:var(--water)"/></linearGradient></defs>`;
    for (let i = 0; i <= 3; i++) { const v = (max / 3) * i, y = H - B - (v / max) * (H - B - T); s += `<line class="gl" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 6}" y="${y + 3.5}" text-anchor="end">${Math.round(v)}</text>`; }
    vals.forEach((v, i) => {
      const h = (v.l / max) * (H - B - T), x = L + i * bw + bw * 0.22, w = bw * 0.56, y = H - B - h;
      s += `<rect class="bar grow" x="${x}" y="${y}" width="${w}" height="${Math.max(h, 0.5)}" rx="2" style="animation-delay:${i * 70}ms" data-tip="${dayLabel(v.d)}<br>${num(v.l, 0)} L · ${v.n} arrosage(s)"/>`;
      if (v.l > 0) s += `<text class="lbl pop" x="${x + w / 2}" y="${y - 6}" text-anchor="middle" style="animation-delay:${400 + i * 70}ms">${Math.round(v.l)}</text>`;
      s += `<text class="ax" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${dayLabel(v.d)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${s}</svg>`;
    tips(el);
  }

  /* --------- humidité du sol par jour --------- */
  function moisture(st, s) {
    const el = $("#viz-moisture");
    if (!st.moisture.length) return empty(el, "Pas encore de relevés.");
    const { W, H } = box(el), L = 36, B = 26, T = 10;
    const Y = (v) => T + (1 - v / 80) * (H - T - B);
    const bw = (W - L) / st.moisture.length;
    const th = s?.thresholds;
    let g = "";
    if (th) g += `<rect class="band" x="${L}" y="${Y(th.target)}" width="${W - L}" height="${Y(th.threshold) - Y(th.target)}"/><text class="ax" x="${W - 4}" y="${Y(th.target) - 4}" text-anchor="end" style="fill:var(--olive)">zone idéale</text>`;
    for (let v = 0; v <= 80; v += 20) g += `<line class="gl" x1="${L}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}%</text>`;
    st.moisture.forEach((m, i) => {
      const cx = L + i * bw + bw / 2, w = Math.min(18, bw * 0.4);
      g += `<rect class="rng grow" x="${cx - w / 2}" y="${Y(m.max)}" width="${w}" height="${Math.max(2, Y(m.min) - Y(m.max))}" rx="${w / 2}" style="animation-delay:${i * 80}ms" data-tip="${dayLabel(m.day)}<br>min ${num(m.min)} % · max ${num(m.max)} %<br>moyenne ${num(m.avg)} %"/>`;
      g += `<circle class="avg pop" cx="${cx}" cy="${Y(m.avg)}" r="4" style="animation-delay:${500 + i * 80}ms"/>`;
      g += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${dayLabel(m.day)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
    tips(el);
  }

  /* --------- carte de chaleur --------- */
  const STOPS = [[30, "#efe6cf"], [60, "#a9c9c9"], [85, "#2c6e8f"], [100, "#18384a"]];
  function heatColor(v) {
    if (v <= STOPS[0][0]) return STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], t = (v - a) / (b - a);
        const p = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
        const x = p(ca), y = p(cb);
        return `rgb(${x.map((c, j) => Math.round(c + (y[j] - c) * t)).join(",")})`;
      }
    }
    return STOPS[STOPS.length - 1][1];
  }
  function heat(st) {
    const el = $("#viz-heat");
    if (!st.climate.length) return empty(el, "Pas encore de relevés.");
    const days = [...new Set(st.climate.map((c) => c.day))];
    const map = Object.fromEntries(st.climate.map((c) => [`${c.day}|${c.hour}`, c]));
    let h = "";
    days.forEach((d, di) => {
      h += `<span class="d">${dayLabel(d)}</span>`;
      for (let hr = 0; hr < 24; hr++) {
        const c = map[`${d}|${hr}`];
        h += c ? `<span class="c" style="background:${heatColor(c.rh)};animation-delay:${(di * 24 + hr) * 4}ms" data-tip="${dayLabel(d)} · ${hr} h<br>${num(c.rh, 0)} % · ${num(c.temp)} °C"></span>`
               : `<span class="c" style="opacity:.35"></span>`;
      }
    });
    h += `<span></span>` + Array.from({ length: 24 }, (_, i) => `<span class="h">${i}</span>`).join("");
    el.innerHTML = h;
    el.style.position = "relative";
    tips(el);
  }

  /* --------- radar des risques --------- */
  function radar(s) {
    const el = $("#viz-radar");
    const risks = s?.disease?.risks || [];
    if (!risks.length) return empty(el, "Pas encore assez de relevés.");
    const { W, H } = box(el);
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 46;
    const axes = risks.length >= 3 ? risks : [...risks, ...Array(3 - risks.length).fill(null)];
    const n = axes.length;
    const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
    let g = "";
    for (const lv of [0.25, 0.5, 0.75, 1]) g += `<polygon class="web" points="${axes.map((_, i) => pt(i, lv).join(",")).join(" ")}"/>`;
    axes.forEach((r, i) => {
      const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2);
      g += `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      if (r) g += `<text class="name" x="${lx}" y="${ly}" text-anchor="${lx < cx - 5 ? "end" : lx > cx + 5 ? "start" : "middle"}" dominant-baseline="middle">${esc(r.label.replace(/\s*\(.*\)/, "").replace(/ \/.*/, ""))}</text>`;
    });
    const poly = axes.map((r, i) => pt(i, Math.max(0.03, (r?.risk || 0) / 100)).join(",")).join(" ");
    g += `<polygon class="area" points="${poly}"/>`;
    axes.forEach((r, i) => {
      if (!r) return;
      const [x, y] = pt(i, Math.max(0.03, r.risk / 100));
      g += `<circle class="pt pop" cx="${x}" cy="${y}" r="3.5" style="animation-delay:${600 + i * 80}ms" data-tip="${esc(r.label)}<br>${num(r.risk, 0)} % · ${r.level}"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
    tips(el);
  }

  /* --------- températures --------- */
  function temps(st) {
    const el = $("#viz-temp");
    if (!st.temp.length) return empty(el, "Pas encore de relevés.");
    const { W, H } = box(el), L = 36, B = 26, T = 18;
    const lo = Math.floor(Math.min(...st.temp.map((t) => t.min)) / 5) * 5, hi = Math.ceil(Math.max(...st.temp.map((t) => t.max)) / 5) * 5;
    const Y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
    const bw = (W - L) / st.temp.length;
    let g = "";
    for (let v = lo; v <= hi; v += 5) g += `<line class="gl" x1="${L}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}°</text>`;
    st.temp.forEach((t, i) => {
      const cx = L + i * bw + bw / 2;
      g += `<line class="tline grow" x1="${cx}" x2="${cx}" y1="${Y(t.max)}" y2="${Y(t.min)}" style="animation-delay:${i * 80}ms"/>`;
      g += `<circle class="tmax pop" cx="${cx}" cy="${Y(t.max)}" r="5" style="animation-delay:${400 + i * 80}ms" data-tip="${dayLabel(t.day)}<br>max ${num(t.max)} °C"/>`;
      g += `<circle class="tmin pop" cx="${cx}" cy="${Y(t.min)}" r="5" style="animation-delay:${400 + i * 80}ms" data-tip="${dayLabel(t.day)}<br>min ${num(t.min)} °C"/>`;
      g += `<text class="ax" x="${cx}" y="${Y(t.max) - 10}" text-anchor="middle" style="fill:var(--clay)">${Math.round(t.max)}°</text>`;
      g += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${dayLabel(t.day)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
    tips(el);
  }

  /* --------- N-P-K --------- */
  function npk(st) {
    const el = $("#viz-npk");
    const rows = st.npk.filter((r) => r.n != null);
    if (rows.length < 2) return empty(el, "Il faut au moins deux jours de relevés.");
    const ref = state.kb?.nutrients || { N: { low: 20, high: 60 }, P: { low: 15, high: 50 }, K: { low: 120, high: 300 } };
    el.innerHTML = [["N", "n", "Azote"], ["P", "p", "Phosphore"], ["K", "k", "Potassium"]].map(([K, f, name]) => {
      const vals = rows.map((r) => r[f]);
      const lo = Math.min(...vals, ref[K].low) * 0.85, hi = Math.max(...vals, ref[K].high) * 1.05;
      const W = 300, H = 110, Y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 26);
      const X = (i) => (i / (vals.length - 1)) * W;
      const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
      const delta = vals[vals.length - 1] - vals[0];
      return `<div class="cell">
        <h3>${name} (${K}) <span class="${delta < 0 && vals[vals.length - 1] < ref[K].low * 1.2 ? "down" : ""}">${num(vals[vals.length - 1], 0)} · ${delta >= 0 ? "+" : ""}${num(delta, 0)}</span></h3>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <rect class="zone" x="0" y="${Y(ref[K].high)}" width="${W}" height="${Y(ref[K].low) - Y(ref[K].high)}"/>
          <path class="ln draw" d="${d}" style="--len:${W * 2}" vector-effect="non-scaling-stroke"/>
          ${rows.map((r, i) => (i === 0 || i === rows.length - 1) ? `<text class="ax" x="${X(i)}" y="${H - 2}" text-anchor="${i ? "end" : "start"}">${dayLabel(r.day)}</text>` : "").join("")}
        </svg></div>`;
    }).join("");
  }

  window.loadAnalytics = async function () {
    const [st, s] = await Promise.all([api("/api/stats?days=7"), state.status ? Promise.resolve(state.status) : api("/api/status")]);
    kpis(st, s);
    water(st); moisture(st, s); heat(st); radar(s); temps(st); npk(st);
    window.observeReveal && window.observeReveal();
  };
})();
