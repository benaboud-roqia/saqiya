/* Sāqiya — photos de la parcelle : envoi, analyse réelle des couleurs, diagnostic IA (Claude), galerie, visionneuse. */
(function () {
  const KINDS = { parcelle: "Parcelle", feuilles: "Feuilles", fruits: "Fruits", sol: "Sol", materiel: "Matériel" };
  let photos = [], filter = "", current = null, poll = null, aiReady = false;
  const ar = () => window.LANG === "ar";

  const EMPTY = `<div class="gallery-empty">
    <svg viewBox="0 0 240 150" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="40" y="30" width="160" height="100" rx="8"/><path d="M90 30l10-14h40l10 14"/><circle cx="120" cy="80" r="28"/>
      <path d="M120 66c6 6 9 12 6 20-8 0-14-6-14-14 3-3 5-5 8-6Z" fill="currentColor" opacity=".15"/>
      <path d="M112 92c4-6 8-12 14-18"/><circle cx="178" cy="46" r="4"/>
    </svg>
    <p>Aucun diagnostic pour l'instant. Photographiez une feuille de près, à la lumière du jour : le système vous dira si elle est malade et quoi faire.</p></div>`;

  /* ---------- analyse réelle des couleurs (dans le navigateur, sans Internet) ---------- */
  function colorStats(canvas) {
    const w = 160, h = Math.max(1, Math.round(canvas.height * 160 / canvas.width));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(canvas, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let n = 0, green = 0, yellow = 0, brown = 0, white = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      let hue = 0;
      if (mx !== mn) hue = mx === r ? 60 * (((gg - b) / (mx - mn)) % 6) : mx === gg ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - gg) / (mx - mn) + 4);
      if (hue < 0) hue += 360;
      n++;
      if (v < 0.13) dark++;
      else if (s < 0.13 && v > 0.82) white++;
      else if (hue >= 70 && hue <= 170 && s > 0.18) green++;
      else if (hue >= 42 && hue < 70 && s > 0.28 && v > 0.35) yellow++;
      else if (hue >= 8 && hue < 42 && s > 0.25 && v > 0.12 && v < 0.7) brown++;
    }
    const pct = (x) => Math.round((x / n) * 1000) / 10;
    return { green: pct(green), yellow: pct(yellow), brown: pct(brown), white: pct(white), dark: pct(dark), plant: pct(green + yellow + brown) };
  }
  function colorReading(c) {
    if (!c) return null;
    const plant = Math.max(1, c.green + c.yellow + c.brown);
    const y = Math.round((c.yellow / plant) * 100), b = Math.round((c.brown / plant) * 100);
    const hints = [];
    if (c.plant < 15) hints.push("Peu de végétation visible : photographiez la feuille de plus près.");
    if (y >= 20) hints.push(`${y} % de la plante est jaune : possible manque d'azote, excès d'eau ou chlorose.`);
    if (b >= 12) hints.push(`${b} % de zones brunes : taches ou nécroses, à surveiller (mildiou, brûlure, carence).`);
    if (c.white >= 8 && c.green > 10) hints.push("Zones blanchâtres : peut indiquer un feutrage d'oïdium (ou un reflet de lumière).");
    if (!hints.length && c.plant >= 15) hints.push("Couleurs surtout vertes : pas de signe visible de jaunissement ou de taches.");
    return { y, b, hints };
  }

  /* ---------- galerie ---------- */
  function badge(p) {
    if (p.analysis_status === "pending") return `<span class="ai-badge wait"><i></i>Analyse IA…</span>`;
    if (p.analysis_status === "done" && p.analysis) {
      const a = p.analysis, top = a.diagnoses?.[0];
      if (!a.is_plant) return `<span class="ai-badge unk">Pas de plante reconnue</span>`;
      if (a.status === "sain") return `<span class="ai-badge ok">✓ Plante saine</span>`;
      if (top) return `<span class="ai-badge ${a.urgency === "haute" ? "bad" : "warn"}">${esc(ar() ? top.name_ar : top.name_fr)} · ${top.confidence} %</span>`;
      return `<span class="ai-badge warn">${a.status === "stress" ? "Stress" : "À surveiller"}</span>`;
    }
    if (p.analysis_status === "error") return `<span class="ai-badge unk">Analyse impossible</span>`;
    const r = colorReading(p.colors);
    if (r && (r.y >= 20 || r.b >= 12)) return `<span class="ai-badge warn">Jaune ${r.y} % · brun ${r.b} %</span>`;
    return "";
  }
  // résultat simple d'une photo : malade / à surveiller / saine / en cours / couleurs seulement
  function verdictOf(p) {
    const L = ar();
    if (p.analysis_status === "pending") return { k: "attente", cls: "wait", title: L ? "التشخيص جارٍ…" : "Diagnostic en cours…", text: L ? "يفحص الذكاء الاصطناعي الصورة (10 إلى 30 ثانية)." : "L'IA examine la photo (10 à 30 secondes)." };
    const a = p.analysis;
    if (p.analysis_status === "done" && a) {
      if (!a.is_plant) return { k: "surveiller", cls: "unk", title: L ? "لم يتم التعرف على نبات" : "Pas de plante reconnue", text: L ? "صوّر ورقة واحدة عن قرب." : "Reprenez une feuille de près, bien nette." };
      const top = a.diagnoses?.[0];
      const sum = (L ? a.summary_ar : a.summary_fr) || "";
      if (a.status === "sain") return { k: "sain", cls: "ok", title: L ? "نبات سليم" : "Plante saine", text: sum };
      if (a.status === "malade" && top) return { k: "malade", cls: a.urgency === "haute" ? "bad" : "warn", title: `${L ? top.name_ar : top.name_fr}`, conf: top.confidence, text: sum, urg: a.urgency };
      return { k: "surveiller", cls: "warn", title: a.status === "stress" ? (L ? "نبات مجهد" : "Plante stressée") : (L ? "للمراقبة" : "À surveiller"), text: sum };
    }
    if (p.analysis_status === "error") return { k: "surveiller", cls: "unk", title: L ? "تعذر التحليل" : "Analyse impossible", text: a?.error || "" };
    const r = colorReading(p.colors);
    if (!r) return { k: "surveiller", cls: "unk", title: "—", text: "" };
    const sick = r.y >= 20 || r.b >= 12;
    return { k: sick ? "surveiller" : "sain", cls: sick ? "warn" : "ok", title: sick ? (L ? "أعراض ظاهرة" : "Symptômes visibles") : (L ? "لا أعراض ظاهرة" : "Pas de symptôme visible"),
      text: r.hints[0] || "", colorsOnly: true };
  }
  function render() {
    const L = ar();
    const list = photos.filter((p) => p.kind !== "sol" && p.kind !== "materiel").filter((p) => !filter || verdictOf(p).k === filter);
    const URG = { faible: L ? "استعجال ضعيف" : "urgence faible", moyenne: L ? "استعجال متوسط" : "urgence moyenne", haute: L ? "استعجال عالٍ" : "urgence haute" };
    $("#gallery").innerHTML = list.length ? list.map((p, i) => {
      const v = verdictOf(p);
      return `<article class="dz-card ph ${v.cls}" data-id="${p.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <div class="dz-img"><img src="/photos/${encodeURIComponent(p.file)}" alt="${esc(p.caption || KINDS[p.kind])}" loading="lazy"></div>
        <div class="dz-body">
          <span class="dz-chip ${v.cls}">${v.cls === "wait" ? "<i></i>" : ""}${esc(v.title)}${v.conf ? ` · ${v.conf} %` : ""}</span>
          ${v.urg && URG[v.urg] ? `<span class="dz-urg ${v.urg}">${URG[v.urg]}</span>` : ""}
          <p dir="auto">${esc(v.text)}</p>
          <small>${KINDS[p.kind] || p.kind}${p.caption ? " · " + esc(p.caption) : ""} · ${dayHm(p.ts)}${v.colorsOnly ? (L ? " · تحليل الألوان" : " · analyse des couleurs") : ""}</small>
        </div>
      </article>`;
    }).join("") : (photos.length ? `<p class="dz-none">${L ? "لا توجد صورة في هذه الفئة." : "Aucune photo dans cette catégorie."}</p>` : EMPTY);
    renderWatch();
  }
  // maladies surveillées : risques réels calculés par le modèle à partir des mesures du capteur
  function renderWatch() {
    const el = $("#dz-watch"), s = (typeof state !== "undefined" && state.status) || null;   // état global de app.js
    const risks = s?.disease?.available ? s.disease.risks : null;
    $("#dz-watch-note").textContent = risks ? (ar() ? "الخطر محسوب بقياسات المستشعر" : "risque calculé avec les mesures du capteur") : (ar() ? "في انتظار قياسات الجهاز" : "en attente des mesures du boîtier");
    if (!risks) { el.innerHTML = ""; return; }
    el.innerHTML = risks.map((r) => {
      const [fr, arn] = (/^(.*?)\s*\((.*)\)$/.exec(r.label) || [null, r.label, ""]).slice(1);
      return `<div class="dz-w lv-${r.level}"><div class="dz-w-h"><b>${esc(ar() && arn ? arn : fr)}</b><span>${num(r.risk, 0)} %</span></div>
        <div class="dz-w-bar"><i style="width:${Math.max(2, r.risk)}%"></i></div>
        <p>${esc(r.conditions)}</p></div>`;
    }).join("");
  }

  async function refreshList() {
    photos = await api("/api/photos").catch(() => photos);
    render();
    if (current) { current = photos.find((p) => p.id === current.id) || current; renderDiag(); }
    clearInterval(poll);
    if (photos.some((p) => p.analysis_status === "pending")) poll = setInterval(async () => {
      if (!$("#view-photos").classList.contains("active") && $("#lightbox").hidden) return;
      const before = JSON.stringify(photos.map((p) => p.analysis_status));
      photos = await api("/api/photos").catch(() => photos);
      if (JSON.stringify(photos.map((p) => p.analysis_status)) !== before) { render(); if (current) { current = photos.find((p) => p.id === current.id); renderDiag(); } }
      if (!photos.some((p) => p.analysis_status === "pending")) clearInterval(poll);
    }, 3000);
  }
  window.loadPhotos = async function () {
    const s = await api("/api/settings").catch(() => ({}));
    aiReady = !!s.ai_configured;

    await refreshList();
  };

  $$("#photo-filters button").forEach((b) => b.addEventListener("click", () => {
    $$("#photo-filters button").forEach((x) => x.classList.toggle("on", x === b));
    filter = b.dataset.k;
    render();
  }));

  /* ---------- envoi ---------- */
  async function prepare(file, max = 1600) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return { data: c.toDataURL("image/jpeg", 0.88), colors: colorStats(c) };
    } finally { URL.revokeObjectURL(url); }
  }
  $("#photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = $("#photo-form");
    form.classList.add("uploading");
    try {
      const { data, colors } = await prepare(file);
      const r = await api("/api/photos", { method: "POST", body: JSON.stringify({ data, colors, caption: form.caption.value, kind: form.kind.value }) });
      form.caption.value = "";
      toast(r.ai ? "Photo reçue · diagnostic en cours…" : "Photo reçue · analyse des couleurs faite");
      await refreshList();
    } catch (err) {
      toast("Envoi impossible : " + err.message);
    } finally {
      form.classList.remove("uploading");
      e.target.value = "";
    }
  });

  /* ---------- visionneuse + diagnostic ---------- */
  function renderDiag() {
    const p = current, box = $("#lb-diag");
    if (!p) return;
    const a = p.analysis, L = ar();
    const cr = colorReading(p.colors);
    let html = "";
    if (p.analysis_status === "pending") {
      html += `<div class="dg-wait"><i></i><b>Diagnostic IA en cours…</b><p>L'IA examine la photo et les mesures de la parcelle (10 à 30 secondes).</p></div>`;
    } else if (p.analysis_status === "done" && a) {
      const st = { sain: ["ok", "Plante saine"], malade: ["bad", "Maladie probable"], stress: ["warn", "Plante stressée"], inconnu: ["unk", "Diagnostic incertain"] }[a.status] || ["unk", "—"];
      const urg = { aucune: "Aucune urgence", faible: "Urgence faible", moyenne: "Urgence moyenne", haute: "Urgence haute" }[a.urgency] || "";
      html += `<div class="dg-head ${st[0]}"><span>${st[1]}</span><small>${esc(a.plant || "")}${urg ? " · " + urg : ""}</small></div>
        <p class="dg-sum" dir="auto">${esc(L ? a.summary_ar : a.summary_fr)}</p>`;
      if (a.diagnoses?.length) html += `<h4>Hypothèses</h4><ul class="dg-list">${a.diagnoses.map((d) => `
          <li><div class="dg-row"><b dir="auto">${esc(L ? d.name_ar : d.name_fr)}</b><span>${d.confidence} %</span></div>
            <div class="dg-bar"><i style="width:${d.confidence}%"></i></div>
            <p dir="auto">${esc(L ? d.evidence_ar : d.evidence_fr)}</p></li>`).join("")}</ul>`;
      const adv = L ? a.advice_ar : a.advice_fr;
      if (adv?.length) html += `<h4>Que faire ?</h4><ol class="dg-adv">${adv.map((x) => `<li dir="auto">${esc(x)}</li>`).join("")}</ol>`;
      html += `<p class="dg-note">Diagnostic par IA à partir d'une seule photo : à confirmer par un technicien agricole avant tout traitement.</p>`;
    } else if (p.analysis_status === "error") {
      html += `<div class="dg-head unk"><span>Analyse impossible</span><small>${esc(a?.error || "")}</small></div>`;
    }
    if (cr) {
      html += `<h4>Analyse des couleurs</h4>
        <div class="dg-colors"><span style="--c:#4f9a3a">Vert ${num(p.colors.green, 0)} %</span><span style="--c:#d9b93a">Jaune ${num(p.colors.yellow, 0)} %</span>
          <span style="--c:#8a5a33">Brun ${num(p.colors.brown, 0)} %</span><span style="--c:#d8d8d0">Blanc ${num(p.colors.white, 0)} %</span></div>
        <ul class="dg-hints">${cr.hints.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`;
    }
    if (aiReady && p.kind !== "sol" && p.kind !== "materiel") {
      html += `<button class="btn btn-ink dg-run" id="dg-run" ${p.analysis_status === "pending" ? "disabled" : ""}>${p.analysis_status === "done" ? "Relancer le diagnostic IA" : "Lancer le diagnostic IA"}</button>`;
    }
    box.innerHTML = html || `<p class="dg-note">Aucune analyse pour cette photo.</p>`;
  }
  $("#lb-diag").addEventListener("click", async (e) => {
    if (e.target.id !== "dg-run" || !current) return;
    try {
      await api(`/api/photos/${current.id}/analyze`, { method: "POST", body: "{}" });
      current.analysis_status = "pending";
      renderDiag();
      await refreshList();
    } catch (err) { toast(err.message); }
  });

  $("#gallery").addEventListener("click", (e) => {
    const f = e.target.closest(".ph");
    if (!f) return;
    current = photos.find((p) => p.id === +f.dataset.id);
    if (!current) return;
    $("#lb-img").src = "/photos/" + encodeURIComponent(current.file);
    $("#lb-cap").textContent = [KINDS[current.kind], current.caption, dayHm(current.ts)].filter(Boolean).join(" · ");
    renderDiag();
    $("#lightbox").hidden = false;
  });
  const close = () => { $("#lightbox").hidden = true; current = null; };
  $("#lb-close").addEventListener("click", close);
  $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#lightbox").hidden) close(); });
  $("#lb-del").addEventListener("click", async () => {
    if (!current || !confirm("Supprimer définitivement cette photo ?")) return;
    await api(`/api/photos/${current.id}/delete`, { method: "POST" });
    close();
    toast("Photo supprimée");
    loadPhotos();
  });
})();
