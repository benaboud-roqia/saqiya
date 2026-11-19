/* Sāqiya — animations de la page « À propos ».
   Les blocs apparaissent en cascade (animation CSS rejouée à chaque ouverture de l'onglet),
   et les chiffres du bandeau comptent jusqu'à leur valeur. Sans animation, tout reste lisible. */
(function () {
  const root = document.getElementById("about");
  if (!root) return;
  const items = root.querySelectorAll(".ab2-hero-in, .ab2-h, .ab2-sub, .ab2-flow li, .ab2-p, .ab2-gal figure, .ab2-made > *");
  items.forEach((el, i) => { el.classList.add("rv"); el.style.setProperty("--d", `${Math.min(i, 14) * 60}ms`); });

  function count(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else el.textContent = end;
    };
    requestAnimationFrame(step);
  }
  // rejoue les animations et les compteurs à chaque ouverture de l'onglet « À propos »
  function play() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.remove("ab2-play"); void root.offsetWidth; root.classList.add("ab2-play");
    items.forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
    root.querySelectorAll("[data-count]").forEach(count);
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest('#st-tabs [data-tab="apropos"]')) setTimeout(play, 30);
  });
  const y = document.getElementById("ab-year");
  if (y) y.textContent = new Date().getFullYear();
})();
