/* Sāqiya — lumière au survol et palette de commandes (Ctrl+K). */
(function () {
  /* ---------- lumière qui suit le pointeur ---------- */
  let raf = 0, lastEv = null;
  document.addEventListener("pointermove", (e) => {
    lastEv = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = lastEv.target.closest?.(".panel, .kpi, .ro");
      if (!el) return;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${lastEv.clientX - b.left}px`);
      el.style.setProperty("--my", `${lastEv.clientY - b.top}px`);
    });
  }, { passive: true });

  /* ---------- palette de commandes ---------- */
  const go = (v) => () => show(v);
  const theme = (t) => () => setTheme(t);
  const pump = (action, min) => async () => {
    await api("/api/pump", { method: "POST", body: JSON.stringify(min ? { action, duration_s: min * 60 } : { action }) });
    toast(action === "on" ? `Arrosage lancé pour ${min} min` : "Pompe arrêtée");
    refresh();
  };
  const mode = (m) => async () => {
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ mode: m }) });
    toast(m === "auto" ? "Mode automatique activé" : "Mode manuel activé");
    refresh();
  };
  const ask = (q) => () => { show("chat"); setTimeout(() => send(q), 150); };

  const COMMANDS = [
    ["Aller à", "▦", "Parcelle", "vue d'ensemble", go("overview"), "parcelle accueil jauge scene"],
    ["Aller à", "▤", "Analyses", "7 jours", go("analytics"), "graphiques statistiques semaine eau"],
    ["Aller à", "◫", "Photos", "galerie", go("photos"), "images galerie camera"],
    ["Aller à", "✦", "Conseiller", "الخبير الفلاحي", go("chat"), "chat chatbot question expert"],
    ["Aller à", "☰", "Journal", "arrosages", go("history"), "historique arrosages"],
    ["Aller à", "⚙", "Réglages", "parcelle, seuils", go("settings"), "parametres configuration"],
    ["Irrigation", "💧", "Arroser 5 minutes", "manuel", pump("on", 5), "arroser pompe eau start demarrer"],
    ["Irrigation", "💧", "Arroser 10 minutes", "manuel", pump("on", 10), "arroser pompe eau"],
    ["Irrigation", "■", "Arrêter la pompe", "", pump("off"), "stop arreter pompe"],
    ["Irrigation", "A", "Mode automatique", "", mode("auto"), "auto automatique mode"],
    ["Irrigation", "M", "Mode manuel", "", mode("manuel"), "manuel mode"],
    ["Conseiller", "?", "Faut-il arroser aujourd'hui ?", "هل يجب أن أسقي اليوم؟", ask("هل يجب أن أسقي اليوم؟"), "arroser aujourd'hui question"],
    ["Conseiller", "?", "Quel engrais utiliser ?", "ما نوع السماد", ask("ما نوع السماد الذي يجب استخدامه؟"), "engrais sol azote"],
    ["Conseiller", "?", "Risque de maladie ?", "", ask("Y a-t-il un risque de maladie cette semaine ?"), "maladie mildiou"],
    ["Apparence", "◆", "Thème bleu nuit", "", theme("bleu"), "theme bleu nuit medical"],
    ["Apparence", "◐", "Thème automatique", "", theme("auto"), "theme auto"],
    ["Apparence", "○", "Thème clair", "", theme("carnet"), "theme clair blanc"],
    ["Apparence", "●", "Thème nuit", "", theme("nuit"), "theme nuit sombre dark"],
    ["Apparence", "◒", "Thème oasis", "", theme("oasis"), "theme oasis vert"],
    ["Apparence", "◓", "Thème désert", "", theme("desert"), "theme desert sable"],
    ["Site", "↗", "Site de présentation", "", () => { location.href = "/"; }, "site accueil presentation"],
    ["Compte", "⎋", "Se déconnecter", "", () => document.getElementById("me-out")?.click(), "deconnexion logout quitter sortir compte"],
  ];

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let box = null, sel = 0, shown = [];

  function render(q) {
    const nq = norm(q.trim());
    shown = COMMANDS.filter((c) => !nq || nq.split(/\s+/).every((w) => norm(c[2] + " " + c[3] + " " + c[5] + " " + c[0]).includes(w)));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    const list = box.querySelector(".kbar-list");
    if (!shown.length) { list.innerHTML = `<li class="kbar-empty">Aucune commande pour « ${esc(q)} »</li>`; return; }
    let html = "", grp = "";
    shown.forEach((c, i) => {
      if (c[0] !== grp) { grp = c[0]; html += `<li class="grp">${grp}</li>`; }
      html += `<li><button data-i="${i}" class="${i === sel ? "sel" : ""}"><span class="ic">${c[1]}</span>${esc(c[2])}<small dir="auto">${esc(c[3])}</small></button></li>`;
    });
    list.innerHTML = html;
    list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  }
  function run(i) { const c = shown[i]; close(); c && c[4](); }
  function open() {
    if (box) return;
    box = document.createElement("div");
    box.className = "kbar";
    box.innerHTML = `<div class="kbar-box" role="dialog" aria-label="Palette de commandes">
      <div class="kbar-in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input placeholder="Rechercher une action ou une page…" aria-label="Rechercher"><kbd>Échap</kbd></div>
      <ul class="kbar-list"></ul>
      <div class="kbar-foot"><span><kbd>↑</kbd><kbd>↓</kbd>naviguer</span><span><kbd>Entrée</kbd>exécuter</span><span><kbd>Ctrl</kbd><kbd>K</kbd>ouvrir</span></div>
    </div>`;
    document.body.appendChild(box);
    const input = box.querySelector("input");
    sel = 0; render("");
    input.focus();
    input.addEventListener("input", () => { sel = 0; render(input.value); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); render(input.value); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); render(input.value); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) run(+b.dataset.i);
      else if (e.target === box) close();
    });
  }
  function close() { box?.remove(); box = null; }
  window.openCommandPalette = open;

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box ? close() : open(); }
    else if (e.key === "Escape" && box) close();
  });
  document.getElementById("kbar-btn")?.addEventListener("click", open);
})();
