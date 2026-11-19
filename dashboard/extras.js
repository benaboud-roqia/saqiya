/* Sāqiya — programmation horaire et coûts (Paramètres). */
(function () {
  const form = $("#settings-form");
  const DAYS = ["L", "M", "M", "J", "V", "S", "D"];          // lundi = 0 (comme Python)
  const DAYS_AR = ["ن", "ث", "ر", "خ", "ج", "س", "ح"];
  let windows = [], schedules = [], notify = { alerts: true, pump: true, offline: true, daily: true }, nlang = "fr";
  const changed = () => window.settingsDirtyCheck?.();

  /* ---------- créneaux ---------- */
  function drawWindows() {
    $("#win-list").innerHTML = windows.map((w, i) => `
      <li><input type="time" value="${esc(w.start)}" data-i="${i}" data-k="start"><span>→</span>
          <input type="time" value="${esc(w.end)}" data-i="${i}" data-k="end">
          <button type="button" class="x" data-del="${i}" aria-label="Supprimer">×</button></li>`).join("");
    $("#win-list").classList.toggle("off", !$("#win-on").checked);
  }
  $("#win-list").addEventListener("input", (e) => { const t = e.target; if (t.dataset.k) { windows[+t.dataset.i][t.dataset.k] = t.value; changed(); } });
  $("#win-list").addEventListener("click", (e) => { const d = e.target.dataset.del; if (d != null) { windows.splice(+d, 1); drawWindows(); changed(); } });
  $("#win-add").addEventListener("click", () => { windows.push({ start: "06:00", end: "09:00" }); drawWindows(); changed(); });
  $("#win-on").addEventListener("change", () => { drawWindows(); changed(); });

  /* ---------- arrosages programmés ---------- */
  function drawSchedules() {
    const names = window.LANG === "ar" ? DAYS_AR : DAYS;
    $("#sch-list").innerHTML = schedules.length ? schedules.map((s, i) => `
      <li class="${s.on ? "" : "off"}">
        <div class="sch-top">
          <input type="time" value="${esc(s.time)}" data-i="${i}" data-k="time">
          <span class="sch-dur"><input type="number" min="1" max="60" value="${s.minutes}" data-i="${i}" data-k="minutes"> min</span>
          <input type="checkbox" class="switch" ${s.on ? "checked" : ""} data-i="${i}" data-k="on" title="Activé">
          <button type="button" class="x" data-del="${i}" aria-label="Supprimer">×</button>
        </div>
        <div class="sch-days">${names.map((n, d) => `<button type="button" class="${s.days.includes(d) ? "on" : ""}" data-i="${i}" data-day="${d}">${n}</button>`).join("")}</div>
        <label class="st-check"><input type="checkbox" ${s.only_if_dry ? "checked" : ""} data-i="${i}" data-k="only_if_dry"> <span>Seulement si le sol n'est pas déjà humide</span></label>
      </li>`).join("") : `<li class="empty">Aucun arrosage programmé.</li>`;
  }
  $("#sch-list").addEventListener("input", (e) => {
    const t = e.target, i = +t.dataset.i;
    if (!t.dataset.k) return;
    schedules[i][t.dataset.k] = t.type === "checkbox" ? t.checked : t.dataset.k === "minutes" ? Math.max(1, Math.min(60, +t.value || 1)) : t.value;
    if (t.dataset.k === "on") t.closest("li").classList.toggle("off", !t.checked);
    changed();
  });
  $("#sch-list").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.del != null) { schedules.splice(+t.dataset.del, 1); drawSchedules(); changed(); return; }
    if (t.dataset.day != null) {
      const s = schedules[+t.dataset.i], d = +t.dataset.day;
      s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort();
      t.classList.toggle("on"); changed();
    }
  });
  $("#sch-add").addEventListener("click", () => { schedules.push({ time: "06:30", minutes: 10, days: [0, 1, 2, 3, 4, 5, 6], only_if_dry: true, on: true }); drawSchedules(); changed(); });

  /* ---------- branchement avec la page Paramètres ---------- */
  window.SettingsExtra = {
    fill(s) {
      windows = JSON.parse(JSON.stringify(s.windows || []));
      schedules = JSON.parse(JSON.stringify(s.schedules || []));
      notify = { alerts: true, pump: true, offline: true, daily: true, ...(s.notify || {}) };
      nlang = s.notify_lang || "fr";
      $("#win-on").checked = !!s.windows_enabled;
      form.water_price_m3.value = s.water_price_m3;
      form.electricity_price_kwh.value = s.electricity_price_kwh;
      form.pump_power_kw.value = s.pump_power_kw;
      form.currency.value = s.currency || "DA";
      $$(".cost-grid .cur").forEach((el) => (el.textContent = s.currency || "DA"));
      drawWindows(); drawSchedules();
    },
    read() {
      return {
        windows_enabled: $("#win-on").checked,
        windows: windows.map((w) => ({ start: w.start, end: w.end })),
        schedules: schedules.map((s) => ({ time: s.time, minutes: +s.minutes, days: [...s.days].sort(), only_if_dry: !!s.only_if_dry, on: !!s.on })),
        notify: { alerts: !!notify.alerts, pump: !!notify.pump, offline: !!notify.offline, daily: !!notify.daily },
        notify_lang: nlang,
        water_price_m3: +form.water_price_m3.value, electricity_price_kwh: +form.electricity_price_kwh.value,
        pump_power_kw: +form.pump_power_kw.value, currency: form.currency.value.trim() || "DA",
      };
    },
  };
  form.currency.addEventListener("input", () => $$(".cost-grid .cur").forEach((el) => (el.textContent = form.currency.value || "DA")));
})();
