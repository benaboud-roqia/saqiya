/* Sāqiya — Paramètres : cartes visuelles, curseurs, GPS, langue, barre « non enregistré ». */
(function () {
  const form = $("#settings-form");
  let saved = null;          // réglages tels qu'enregistrés sur le serveur
  const SOIL = {
    sableux: { c1: "#e2c98f", c2: "#c9a86a", d: "Léger, sèche vite" },
    limoneux: { c1: "#b08a5c", c2: "#8c6a43", d: "Équilibré, garde bien l'eau" },
    limono_argileux: { c1: "#94694a", c2: "#6f4c33", d: "Riche, garde l'eau longtemps" },
    argileux: { c1: "#7a5238", c2: "#553623", d: "Lourd, reste humide" },
  };
  const photo = (crop) => `https://images.unsplash.com/${(typeof CROP_PHOTOS !== "undefined" && CROP_PHOTOS[crop]) || "photo-1748432171507-c1d62fe2e859"}?auto=format&fit=crop&w=360&h=260&q=65`;
  const split = (label) => { const m = /^(.*?)\s*\((.*)\)$/.exec(label); return m ? [m[1], m[2]] : [label, ""]; };

  /* ---------- affichage des valeurs ---------- */
  function outputs() {
    const autoThr = $("#thr-auto").checked;
    $("#thr").disabled = autoThr;
    const cur = state.status?.thresholds?.threshold;
    $("#o-thr").textContent = autoThr ? (cur != null ? `Automatique (${num(cur, 0)} %)` : "Automatique") : `${$("#thr").value} %`;
    form.threshold_override.value = autoThr ? "" : $("#thr").value;
    $("#o-max").textContent = `${$("#max-min").value} min`;
    form.max_duration_s.value = +$("#max-min").value * 60;
    const p = +form.min_interval_min.value;
    $("#o-pause").textContent = p === 0 ? "Aucune" : p < 60 ? `${p} min` : `${Math.floor(p / 60)} h${p % 60 ? " " + (p % 60) + " min" : ""}`;
    $("#o-mm").textContent = `${num(form.rain_mm_skip.value)} mm`;
    $("#o-prob").textContent = `${form.rain_prob_skip.value} %`;
    $$("input[type=range]", form).forEach((r) => r.style.setProperty("--pct", ((r.value - r.min) / (r.max - r.min)) * 100 + "%"));
    $$("#crop-pick button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === form.crop.value)));
    $$("#soil-pick button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === form.soil_type.value)));
    $$("#mode-pick button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === form.mode.value)));
    $$("#lang-pick button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lang === (window.LANG || "fr"))));
  }

  function current() {
    outputs();
    const v = (n) => form[n].value;
    return {
      crop: v("crop"), soil_type: v("soil_type"), mode: v("mode"),
      threshold_override: v("threshold_override") === "" ? null : +v("threshold_override"),
      max_duration_s: +v("max_duration_s"), min_interval_min: +v("min_interval_min"),
      pump_flow_lpm: +v("pump_flow_lpm"), rain_mm_skip: +v("rain_mm_skip"), rain_prob_skip: +v("rain_prob_skip"),
      latitude: +v("latitude"), longitude: +v("longitude"), sec_per_percent: +v("sec_per_percent"),
      ...(window.SettingsExtra?.read() || {}),
    };
  }
  window.settingsDirtyCheck = () => dirtyCheck();
  function dirtyCheck() {
    if (!saved) return;
    const c = current();
    const same = (a, b) => (typeof a === "object" || typeof b === "object") ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null) : String(a ?? "") === String(b ?? "");
    const dirty = Object.keys(c).some((k) => !same(c[k], saved[k]));
    $("#st-save").hidden = !dirty;
  }

  function fill(s) {
    form.crop.value = s.crop; form.soil_type.value = s.soil_type; form.mode.value = s.mode;
    const auto = s.threshold_override == null || s.threshold_override === "";
    $("#thr-auto").checked = auto;
    $("#thr").value = auto ? (state.status?.thresholds?.threshold ?? 30) : s.threshold_override;
    $("#max-min").value = Math.max(1, Math.round(s.max_duration_s / 60));
    form.min_interval_min.value = s.min_interval_min;
    form.pump_flow_lpm.value = s.pump_flow_lpm;
    form.rain_mm_skip.value = s.rain_mm_skip;
    form.rain_prob_skip.value = s.rain_prob_skip;
    form.latitude.value = s.latitude; form.longitude.value = s.longitude;
    form.sec_per_percent.value = s.sec_per_percent;
    window.SettingsExtra?.fill(s);
    outputs();
  }

  window.loadSettings = async function () {
    const [s, kb] = await Promise.all([api("/api/settings"), state.kb ? Promise.resolve(state.kb) : api("/api/knowledge")]);
    state.kb = kb;
    $("#crop-pick").innerHTML = Object.entries(kb.crops).map(([k, label]) => {
      const [fr, ar] = split(label);
      return `<button type="button" role="radio" data-v="${esc(k)}">
        <img src="${photo(k)}" alt="" loading="lazy"><span><b>${esc(fr)}</b><small lang="ar">${esc(ar)}</small></span></button>`;
    }).join("");
    $("#soil-pick").innerHTML = Object.entries(kb.soil_types).map(([k, label]) => {
      const [fr, ar] = split(label), c = SOIL[k] || SOIL.limoneux;
      return `<button type="button" role="radio" data-v="${esc(k)}" style="--c1:${c.c1};--c2:${c.c2}">
        <i class="soil-sw"></i><b>${esc(fr)}</b><small>${esc(c.d)}</small><small lang="ar">${esc(ar)}</small></button>`;
    }).join("");
    saved = { ...s, threshold_override: s.threshold_override ?? null };
    fill(s);
    $("#st-save").hidden = true;
    $("#st-gps-msg").textContent = "";
  };

  /* ---------- interactions ---------- */
  form.addEventListener("click", (e) => {
    const pick = e.target.closest("#crop-pick button, #soil-pick button, #mode-pick button");
    if (pick) {
      const field = pick.closest("#crop-pick") ? "crop" : pick.closest("#soil-pick") ? "soil_type" : "mode";
      form[field].value = pick.dataset.v;
      dirtyCheck();
      return;
    }
    const st = e.target.closest("[data-step]");
    if (st) {
      const inp = form[st.dataset.for];
      const v = Math.max(+inp.min || 0, Math.round(((+inp.value || 0) + +st.dataset.step) * 10) / 10);
      inp.value = v; dirtyCheck();
    }
  });
  form.addEventListener("input", dirtyCheck);
  $("#thr-auto").addEventListener("change", dirtyCheck);
  $$("#lang-pick button").forEach((b) => b.addEventListener("click", () => { window.setLang?.(b.dataset.lang); outputs(); }));

  $("#st-cancel").addEventListener("click", () => { if (saved) fill(saved); $("#st-save").hidden = true; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = current();
    try {
      const s = await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
      saved = { ...s, threshold_override: s.threshold_override ?? null };
      $("#st-save").hidden = true;
      toast("Réglages enregistrés");
      refresh();
    } catch (err) {
      toast("Impossible d'enregistrer : " + err.message);
    }
  });

  $("#st-gps").addEventListener("click", () => {
    const msg = $("#st-gps-msg");
    if (!navigator.geolocation || !window.isSecureContext) {
      msg.textContent = "La localisation n'est possible que depuis l'ordinateur du serveur (adresse localhost). Sinon, saisissez les coordonnées.";
      return;
    }
    msg.textContent = "Recherche de votre position…";
    navigator.geolocation.getCurrentPosition((p) => {
      form.latitude.value = p.coords.latitude.toFixed(4);
      form.longitude.value = p.coords.longitude.toFixed(4);
      msg.textContent = "Position trouvée. N'oubliez pas d'enregistrer.";
      dirtyCheck();
    }, () => { msg.textContent = "Position refusée ou indisponible. Saisissez les coordonnées à la main."; }, { timeout: 10000 });
  });

  /* ---------- onglets des réglages ---------- */
  const view = $("#view-settings");
  function openTab(name) {
    const btn = $(`#st-tabs [data-tab="${name}"]`);
    if (!btn || getComputedStyle(btn).display === "none") name = "parcelle";
    view.dataset.sec = name;
    $$("#st-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $(`#st-tabs [data-tab="${name}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    try { localStorage.setItem("saqiya-settings-tab", name); } catch { /* préférence non mémorisée */ }
    if (name === "comptes") window.loadAccounts?.();
  }
  $$("#st-tabs button").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
  let firstTab = "parcelle";
  try { firstTab = localStorage.getItem("saqiya-settings-tab") || "parcelle"; } catch { /* idem */ }
  view.dataset.sec = firstTab;
  const prevLoad = window.loadSettings;
  window.loadSettings = async function () { await prevLoad(); openTab(view.dataset.sec || "parcelle"); };

  // la langue peut changer ailleurs (bannière) : on met à jour la sélection
  const prev = window.onLangChange;
  window.onLangChange = () => { prev?.(); outputs(); };
})();
