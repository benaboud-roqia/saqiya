/* Sāqiya — Journal d'irrigation : résumé, filtres, graphique, fil chronologique, export CSV. */
(function () {
  let all = [], days = 7, mode = "";
  const flow = () => +(state.status?.settings?.pump_flow_lpm || 10);
  const litres = (e) => ((e.duration_s || 0) / 60) * flow();
  const dur = (s) => (s == null ? "—" : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`);
  const dayKey = (ts) => { const d = new Date(ts * 1000); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function dayTitle(ts) {
    const k = dayKey(ts), now = Date.now() / 1000;
    if (k === dayKey(now)) return "Aujourd'hui";
    if (k === dayKey(now - 86400)) return "Hier";
    const s = new Date(ts * 1000).toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function ago(ts) {
    const s = Date.now() / 1000 - ts;
    if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
    return `il y a ${Math.round(s / 86400)} j`;
  }

  function filtered() {
    const since = Date.now() / 1000 - days * 86400;
    return all.filter((e) => e.ts_start >= since && (!mode || e.mode === mode));
  }

  function kpis(ev) {
    const done = ev.filter((e) => e.duration_s);
    const total = done.reduce((a, e) => a + litres(e), 0);
    const avg = done.length ? done.reduce((a, e) => a + e.duration_s, 0) / done.length : null;
    const autoShare = ev.length ? Math.round((ev.filter((e) => e.mode === "auto").length / ev.length) * 100) : 0;
    const last = all[0];
    const card = (cls, label, value, unit, sub) => `
      <div class="jr-kpi ${cls}"><span>${label}</span><b data-to="${value}">${value}</b>${unit ? `<small>${unit}</small>` : ""}<em>${sub}</em></div>`;
    $("#jr-kpis").innerHTML =
      card("k-water", "Arrosages", ev.length, "", days === 1 ? "sur 24 h" : `sur ${days} jours`) +
      card("k-blue", "Eau utilisée", Math.round(total), "L", `≈ ${Math.round(total / days)} L par jour`) +
      card("k-time", "Durée moyenne", avg == null ? "—" : Math.round(avg / 60), avg == null ? "" : "min", "par arrosage") +
      `<div class="jr-kpi k-auto"><span>Part automatique</span>
        <div class="ring" style="--p:${autoShare}"><b>${autoShare}</b><small>%</small></div>
        <em>${last ? "Dernier arrosage " + ago(last.ts_start) : "Aucun arrosage"}</em></div>`;
    // chiffres qui défilent
    $$("#jr-kpis b[data-to]").forEach((el) => {
      const to = +el.dataset.to;
      if (!Number.isFinite(to)) return;
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  function bars(ev) {
    const hourly = days === 1;
    $("#jr-chart-title").textContent = hourly ? "Eau par heure" : "Eau par jour";
    const n = hourly ? 24 : days;
    const now = new Date();
    const buckets = Array.from({ length: n }, (_, i) => {
      const d = new Date(now);
      if (hourly) { d.setMinutes(0, 0, 0); d.setHours(d.getHours() - (n - 1 - i)); }
      else { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); }
      return { start: d.getTime() / 1000, l: 0, c: 0 };
    });
    const size = hourly ? 3600 : 86400;
    ev.forEach((e) => {
      const b = buckets.find((x) => e.ts_start >= x.start && e.ts_start < x.start + size);
      if (b) { b.l += litres(e); b.c++; }
    });
    const max = Math.max(1, ...buckets.map((b) => b.l));
    const label = (b) => hourly ? new Date(b.start * 1000).getHours() + " h"
      : new Date(b.start * 1000).toLocaleDateString(LOC(), n > 10 ? { day: "numeric" } : { weekday: "short", day: "numeric" });
    $("#jr-bars").innerHTML = buckets.map((b, i) => `
      <div class="jr-bar" title="${label(b)} · ${Math.round(b.l)} L · ${b.c}">
        <span class="v">${b.l ? Math.round(b.l) : ""}</span>
        <i style="height:${(b.l / max) * 100}%;animation-delay:${i * 25}ms"></i>
        <span class="d">${(!hourly || i % 3 === 0) ? label(b) : ""}</span>
      </div>`).join("");
  }

  function timeline(ev) {
    const el = $("#jr-timeline");
    if (!ev.length) {
      el.innerHTML = `<div class="jr-empty">
        <svg viewBox="0 0 120 90" aria-hidden="true"><path d="M60 12s22 24 22 40a22 22 0 0 1-44 0c0-16 22-40 22-40Z"/><path d="M50 56a10 10 0 0 0 10 10"/></svg>
        <b>Aucun arrosage sur cette période</b><p>Les arrosages apparaîtront ici dès que la pompe aura fonctionné.</p></div>`;
      return;
    }
    let html = "", cur = "", i = 0;
    for (const e of ev) {
      const dk = dayKey(e.ts_start);
      if (dk !== cur) { if (cur) html += `</ol>`; cur = dk; html += `<h3 class="jr-day">${dayTitle(e.ts_start)}</h3><ol class="jr-list">`; }
      const running = !e.ts_end;
      const before = e.moisture_before, after = e.moisture_after;
      const lo = Math.max(0, Math.min(100, before ?? 0)), hi = Math.max(lo, Math.min(100, after ?? lo));
      const auto = e.mode === "auto";
      html += `
        <li class="jr-item ${auto ? "is-auto" : "is-manual"} ${running ? "running" : ""}" style="animation-delay:${Math.min(i++, 15) * 45}ms">
          <time>${hm(e.ts_start)}</time>
          <span class="jr-dot"><svg><use href="${auto ? "#i-drop" : "#i-sliders"}"/></svg></span>
          <div class="jr-card">
            <div class="jr-top">
              <b>${auto ? "Arrosage automatique" : e.mode === "programmé" ? "Arrosage programmé" : "Arrosage manuel"}</b>
              ${running ? `<span class="jr-live">En cours</span>` : `<span class="jr-chip">${dur(e.duration_s)}</span><span class="jr-chip blue">≈ ${Math.round(litres(e))} L</span>`}
            </div>
            <div class="jr-moist">
              <span>${num(before, 0)} %</span>
              <div class="jr-track"><i class="from" style="left:${lo}%"></i><i class="fill" style="left:${lo}%;width:${hi - lo}%"></i></div>
              <span class="to">${after != null ? num(after, 0) + " %" : "…"}</span>
            </div>
            <p>${esc(e.reason || "")}</p>
          </div>
        </li>`;
    }
    el.innerHTML = html + "</ol>";
  }

  function render() {
    const ev = filtered();
    kpis(ev); bars(ev); timeline(ev);
  }

  window.loadEvents = async function () {
    all = await api("/api/irrigation/events?limit=1000").catch(() => []);
    render();
  };

  $$("#jr-period button").forEach((b) => b.addEventListener("click", () => {
    $$("#jr-period button").forEach((x) => x.classList.toggle("on", x === b));
    days = +b.dataset.d; render();
  }));
  $$("#jr-mode button").forEach((b) => b.addEventListener("click", () => {
    $$("#jr-mode button").forEach((x) => x.classList.toggle("on", x === b));
    mode = b.dataset.m; render();
  }));

  $("#jr-export").addEventListener("click", () => {
    const ev = filtered();
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Heure", "Mode", "Durée (s)", "Eau (L)", "Humidité avant (%)", "Humidité après (%)", "Motif"]]
      .concat(ev.map((e) => {
        const d = new Date(e.ts_start * 1000);
        return [d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), e.mode,
          e.duration_s ? Math.round(e.duration_s) : "", e.duration_s ? Math.round(litres(e)) : "",
          e.moisture_before ?? "", e.moisture_after ?? "", e.reason];
      }));
    const csv = "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `journal-irrigation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Journal exporté");
  });
})();
