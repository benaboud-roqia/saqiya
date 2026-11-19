/* Sāqiya — indices « il y a d'autres boutons » : barre d'onglets du téléphone et suggestions du conseiller. */
(function () {
  function watch(el, hintKey) {
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);           // en arabe le défilement est négatif
      el.classList.toggle("at-end", max <= 4 || pos >= max - 4);
    };
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    // petite animation « ça défile » : à chaque ouverture, tant que l'utilisateur n'a pas encore défilé
    let seen = false;
    try { seen = localStorage.getItem(hintKey) === "1"; } catch { /* stockage indisponible */ }
    const nudge = () => {
      if (el.scrollWidth - el.clientWidth <= 4 || el.classList.contains("at-end")) return;
      el.classList.remove("hint"); void el.offsetWidth; el.classList.add("hint");
      setTimeout(() => el.classList.remove("hint"), 4000);
    };
    if (!seen) setTimeout(nudge, 900);
    el.addEventListener("scroll", () => { try { localStorage.setItem(hintKey, "1"); } catch { /* idem */ } }, { once: true, passive: true });
    return nudge;
  }

  const nav = document.querySelector(".rail nav");
  if (nav) {
    const arrow = document.createElement("span");
    arrow.className = "more-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
    nav.after(arrow);
    const mq = window.matchMedia("(max-width: 760px)");
    const show = () => { arrow.hidden = !mq.matches; };
    mq.addEventListener ? mq.addEventListener("change", show) : mq.addListener(show);
    show();
    watch(nav, "saqiya-nav-hint");
    // l'onglet actif reste visible dans la barre
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".rail .nav");
      if (b && mq.matches) b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }
  const prompts = document.getElementById("prompts");
  const nudgePrompts = watch(prompts, "saqiya-prompts-hint");
  // à l'ouverture du conseiller, rappelle que d'autres suggestions existent
  document.addEventListener("click", (e) => {
    if (e.target.closest('.nav[data-view="chat"]') && nudgePrompts) setTimeout(nudgePrompts, 500);
  });
})();
