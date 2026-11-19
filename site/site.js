/* Sāqiya — site de présentation : menu, apparitions, compteur, état de la parcelle en direct. */
(function () {
  const $ = (s) => document.querySelector(s);
  const CFG = Object.assign({ app: "/app/", live: true, embed: true }, window.SAQIYA || {});

  // liens vers le tableau de bord : sur le PC « /app/ », sur GitHub Pages l'adresse choisie dans config.js
  document.querySelectorAll("[data-app]").forEach((a) => { a.href = CFG.app; });
  const frame = document.querySelector("[data-app-frame]");
  if (frame && !CFG.embed) {
    // GitHub Pages (https) ne peut pas afficher le tableau de bord du PC (http) dans la page : panneau à la place
    const body = frame.parentElement;
    body.classList.add("frame-off");
    body.innerHTML = `<div class="frame-off-in">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4"/><path d="M8 12l2.5-3 2 2 3.5-4"/></svg>
        <b>Le tableau de bord tourne sur le PC de la parcelle</b>
        <p>Il reçoit les mesures du boîtier en direct. Ouvrez-le depuis le PC où le serveur Sāqiya est lancé.</p>
        <a class="btn btn-dark" href="${CFG.app}">Ouvrir le tableau de bord</a>
      </div>`;
    const bar = document.querySelector(".frame-bar span");
    if (bar) bar.textContent = CFG.app.replace(/^https?:\/\//, "");
  }

  // en-tête : filet au défilement
  const top = $("#top");
  const onScroll = () => top.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // menu mobile
  const burger = $("#burger"), links = $("#links");
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { links.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
  });

  // compteur
  function countUp(el) {
    const to = +el.dataset.count, t0 = performance.now(), dur = 1600;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // apparitions
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("seen");
        e.target.querySelectorAll("[data-count]").forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el, i) => {
      const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.style.transitionDelay = Math.min(sib, 4) * 90 + "ms";
      io.observe(el);
    });
  } else {
    els.forEach((el) => el.classList.add("seen"));
  }

  // état de la parcelle en direct
  const fmt = (v, d = 1) => (v == null ? "—" : (+v).toFixed(d).replace(".", ","));
  async function live() {
    try {
      const r = await fetch("/api/public/summary", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const s = await r.json();
      $("#lv-soil").textContent = fmt(s.soil_moisture) + " %";
      $("#lv-air").textContent = fmt(s.air_temp) + " °C";
      const p = $("#lv-pump");
      p.textContent = s.pump_on ? "en marche" : "au repos";
      p.classList.toggle("on", !!s.pump_on);
      $("#lv-decision").textContent = s.pump_on ? "Arrosage en cours." : (s.decision || "");
      $("#live").hidden = !s.ts;
    } catch {
      $("#live").hidden = true;
    }
  }
  if (CFG.live) {
    live();
    setInterval(live, 10000);
  } else {
    $("#live").hidden = true;   // pas de serveur derrière GitHub Pages
  }
})();
