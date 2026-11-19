/* Sāqiya — site de présentation : menu, apparitions, compteur, état de la parcelle en direct. */
(function () {
  const $ = (s) => document.querySelector(s);
  const CFG = Object.assign({ app: "/app/", live: true, embed: true }, window.SAQIYA || {});

  // liens vers le tableau de bord : sur le PC « /app/ », sur GitHub Pages l'adresse choisie dans config.js
  document.querySelectorAll("[data-app]").forEach((a) => { a.href = CFG.app; });

  // site en ligne (Vercel / GitHub) : l'adresse du tunnel change à chaque démarrage du PC,
  // on lit donc la dernière adresse publiée par en_ligne.ps1, puis on vérifie que le PC répond.
  if (CFG.addr) {
    let offline = false;
    const AR = () => document.documentElement.lang === "ar";
    const note = () => {
      let t = document.getElementById("app-offline");
      if (!t) {
        t = document.createElement("div"); t.id = "app-offline";
        t.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,440px);padding:12px 16px;border-radius:12px;background:#0b1d33;color:#fff;font:600 .9rem/1.4 system-ui,sans-serif;box-shadow:0 12px 30px -10px rgba(0,0,0,.6);text-align:center";
        document.body.appendChild(t);
      }
      t.textContent = AR() ? "لوحة التحكم غير متاحة الآن: حاسوب المزرعة مطفأ. أعد المحاولة لاحقاً."
                           : "Le tableau de bord est hors ligne pour le moment (PC de la parcelle éteint). Réessayez plus tard.";
      t.hidden = false; clearTimeout(note.h); note.h = setTimeout(() => { t.hidden = true; }, 5000);
    };
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-app]");
      if (a && offline) { e.preventDefault(); note(); }
    }, true);
    fetch(CFG.addr + "?t=" + Date.now(), { cache: "no-store" })
      .then((r) => r.json())
      .then(async (j) => {
        const base = String(j.url || "").replace(/\/$/, "");
        if (!/^https:\/\//.test(base)) throw new Error("adresse");
        const url = base + "/app/";
        document.querySelectorAll("[data-app]").forEach((a) => { a.href = url; });
        CFG.app = url;
        const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
        // échoue si le tunnel est fermé OU si le serveur du PC est arrêté (erreur 502 de Cloudflare, sans en-tête CORS)
        const r = await fetch(base + "/api/alive", { cache: "no-store", signal: ctl.signal });
        offline = !r.ok;
      })
      .catch(() => { offline = true; });
  }
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

  // pied de page : apparition des colonnes, année
  const foot = document.querySelector(".xfoot");
  if (foot) {
    const y = document.getElementById("xf-year");
    if (y) y.textContent = new Date().getFullYear();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { foot.classList.add("seen"); o.disconnect(); } }),
        { threshold: 0.15 }).observe(foot);
      setTimeout(() => foot.classList.add("seen"), 4000);   // au cas où l'observateur ne se déclenche pas
    } else foot.classList.add("seen");
  }
})();
