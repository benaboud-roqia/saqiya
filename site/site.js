/* Sāqiya — site de présentation : menu, apparitions, compteur, état de la parcelle en direct. */
(function () {
  const $ = (s) => document.querySelector(s);

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
  live();
  setInterval(live, 10000);
})();
