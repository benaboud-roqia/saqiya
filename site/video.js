/* Sāqiya — lecteur de la vidéo de présentation : scènes minutées, barre de progression, sous-titres FR / AR. */
(function () {
  const player = document.getElementById("player");
  if (!player) return;
  const scenes = [...player.querySelectorAll(".sc")];
  const durs = scenes.map((s) => +s.dataset.d || 6);
  const total = durs.reduce((a, b) => a + b, 0);
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));
  let t = 0, playing = false, last = 0, cur = -1, autoStarted = false;

  // sous-titres
  let lang = "fr";
  try { lang = localStorage.getItem("saqiya-lang") === "ar" ? "ar" : "fr"; } catch { /* préférence indisponible */ }
  function applyLang() {
    player.dataset.lang = lang;
    player.querySelectorAll("[data-fr]").forEach((el) => (el.textContent = el.dataset[lang] || el.dataset.fr));
    document.getElementById("v-lang").textContent = lang === "ar" ? "FR" : "ع";
  }

  // repères de chapitres
  document.getElementById("v-ticks").innerHTML = starts.slice(1).map((s) => `<i style="left:${(s / total) * 100}%"></i>`).join("");

  function show(i) {
    if (i === cur) return;
    cur = i;
    scenes.forEach((s, k) => {
      if (k === i) { s.classList.remove("on"); void s.offsetWidth; s.classList.add("on"); }   // relance les animations
      else s.classList.remove("on");
    });
  }
  function counter(i, local) {
    const c = scenes[i].querySelector(".counter em");
    if (!c) return;
    const k = Math.max(0, Math.min(1, (local - 1) / 4.5));
    c.textContent = Math.round(12 + (47 - 12) * (1 - Math.pow(1 - k, 2)));
  }
  function render() {
    const i = starts.findIndex((s, k) => t >= s && t < s + durs[k]);
    const idx = i < 0 ? scenes.length - 1 : i;
    show(idx);
    counter(idx, t - starts[idx]);
    document.getElementById("v-fill").style.width = (t / total) * 100 + "%";
    const s = Math.floor(t);
    document.getElementById("v-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function frame(now) {
    if (!playing) return;
    t += (now - last) / 1000;
    last = now;
    if (t >= total) { t = 0; cur = -1; }   // la vidéo tourne en boucle
    render();
    requestAnimationFrame(frame);
  }
  function play() { if (playing) return; playing = true; player.classList.add("playing"); last = performance.now(); requestAnimationFrame(frame); }
  function pause() { playing = false; player.classList.remove("playing"); }
  function seek(sec) { t = Math.max(0, Math.min(total - .01, sec)); cur = -1; render(); }

  document.getElementById("big-play").addEventListener("click", play);
  document.getElementById("v-play").addEventListener("click", () => (playing ? pause() : play()));
  document.getElementById("stage").addEventListener("click", () => (playing ? pause() : play()));
  document.getElementById("v-track").addEventListener("click", (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - b.left) / b.width) * total);
  });
  document.getElementById("v-lang").addEventListener("click", () => { lang = lang === "ar" ? "fr" : "ar"; applyLang(); });
  document.getElementById("v-full").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen(); else player.requestFullscreen?.();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && player.matches(":hover")) { e.preventDefault(); playing ? pause() : play(); }
  });

  // lecture automatique (muette par nature) quand la vidéo devient visible, pause quand on la quitte
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > .5 && !autoStarted) { autoStarted = true; play(); }
      else if (!e.isIntersecting && playing) pause();
    }), { threshold: [0, .5] }).observe(player);
  }

  applyLang();
  render();
})();
