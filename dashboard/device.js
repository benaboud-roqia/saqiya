/* Sāqiya — page « Boîtier » : état en une phrase, mesures du capteur en direct, liaison USB ou WiFi, FR / AR. */
(function () {
  const T = {
    fr: {
      st_ok: "Connecté", st_wait: "En attente", st_sim: "Simulateur", st_off: "Hors ligne", st_usbwait: "USB détecté",
      ok: "Le boîtier fonctionne bien", ok_d: "Dernière mesure {t}. Les mesures arrivent normalement.",
      wait: "Le boîtier n'est pas encore relié", wait_d: "Branchez-le au PC avec le câble USB, ou reliez-le en WiFi (étapes ci-dessous).",
      sim: "Seul le simulateur est relié", sim_d: "Votre vrai boîtier n'a pas encore envoyé de mesure. Branchez-le au PC avec le câble USB.",
      off: "Le boîtier ne répond plus", off_d: "Dernière mesure {t}. Vérifiez le câble USB (ou le WiFi) et l'alimentation.",
      usbwait: "Carte branchée, en attente des mesures", usbwait_d: "Le PC voit la carte sur {t}. Les mesures arrivent au rythme du programme.",
      sensor_bad: "Le boîtier est relié, mais le capteur du sol ne répond pas : vérifiez le 12 V, les fils A et B et la masse commune.",
      busy: "Le port {t} est occupé : fermez le moniteur série de l'IDE Arduino, la lecture reprend toute seule.",
      signal: "Signal WiFi", since: "Allumé depuis", count: "Mesures reçues", link: "Liaison", l_usb: "câble USB", l_wifi: "WiFi",
      sensor: "Capteur du sol", s_ok: "répond", s_bad: "ne répond pas",
      sig: ["très faible", "faible", "moyen", "bon", "excellent"],
      ago_s: "il y a {n} s", ago_m: "il y a {n} min", ago_h: "il y a {n} h", never: "jamais",
      up_m: "{n} min", up_h: "{n} h", up_d: "{n} jours",
      live_title: "Mesures du capteur, en direct", upd: "mise à jour {t}",
      lo: "bas", hi: "élevé", good: "bon", dry: "sec", wet: "très humide", salty: "trop salé", weather: "météo du lieu",
      tiles: { soil_moisture: "Humidité du sol", soil_temp: "Température du sol", soil_ph: "pH", soil_ec: "Salinité (EC)", n: "Azote (N)", p: "Phosphore (P)", k: "Potassium (K)", air_temp: "Température de l'air", air_humidity: "Humidité de l'air" },
      steps_title: "Relier le boîtier", m_usb: "Par câble USB", m_wifi: "Par WiFi",
      u1: "Branchez la carte au PC", u1d: "Avec le câble USB, le programme du capteur déjà dans la carte. Le capteur reste alimenté en 12 V.",
      u2: "Fermez le moniteur série", u2d: "Dans l'IDE Arduino, fermez le moniteur série : sinon il garde le câble pour lui.",
      u3: "C'est tout !", u3d: "Le système trouve la carte tout seul et affiche les mesures ici en quelques secondes. Pour commander la pompe ou poser le boîtier loin du PC, passez en WiFi.",
      s1: "Branchez le boîtier", s1d: "Le petit voyant clignote vite : il cherche le WiFi.",
      s2: "Prenez votre téléphone", s2d: "Ouvrez les réglages WiFi du téléphone et choisissez ce réseau :",
      network: "Réseau", password: "Mot de passe",
      s3: "Copiez ces deux codes", s3d: "Une page s'ouvre sur le téléphone. Choisissez le WiFi de la maison, puis collez ces deux codes.",
      address: "Adresse", key: "Clé secrète", copy: "Copier", copied: "Copié !", show: "Afficher", hide: "Cacher",
      done: "C'est tout ! Quand le voyant clignote doucement, tout marche.",
      led_title: "Que dit le petit voyant ?",
      led_slow: "Clignote doucement : tout va bien", led_fast: "Clignote vite : pas de WiFi",
      led_double: "Double clignotement : l'ordinateur ne répond pas", led_fixed: "Allumé sans arrêt : arrosage en cours",
      trouble: "Ça ne marche pas ?", trouble_d: "Appuyez 3 secondes sur le bouton BOOT du boîtier, puis recommencez à l'étape 2.",
      trouble_usb: "Débranchez puis rebranchez le câble USB, et vérifiez que le moniteur série Arduino est bien fermé.",
      tech: "Pour le technicien",
    },
    ar: {
      st_ok: "متصل", st_wait: "في الانتظار", st_sim: "محاكي", st_off: "غير متصل", st_usbwait: "تم اكتشاف USB",
      ok: "الجهاز يعمل بشكل جيد", ok_d: "آخر قياس {t}. القياسات تصل بشكل عادي.",
      wait: "الجهاز غير مربوط بعد", wait_d: "صِله بالحاسوب بكابل USB، أو اربطه بالواي فاي (الخطوات أدناه).",
      sim: "المحاكي فقط مربوط", sim_d: "جهازك الحقيقي لم يرسل أي قياس بعد. صِله بالحاسوب بكابل USB.",
      off: "الجهاز لا يستجيب", off_d: "آخر قياس {t}. تحقق من كابل USB (أو الواي فاي) ومن التغذية.",
      usbwait: "البطاقة موصولة، في انتظار القياسات", usbwait_d: "الحاسوب يرى البطاقة على {t}. القياسات تصل حسب وتيرة البرنامج.",
      sensor_bad: "الجهاز متصل، لكن مستشعر التربة لا يستجيب: تحقق من 12 فولت، والسلكين A و B، والأرضي المشترك.",
      busy: "المنفذ {t} مشغول: أغلق الشاشة التسلسلية في Arduino، وستستأنف القراءة تلقائيا.",
      signal: "إشارة الواي فاي", since: "يعمل منذ", count: "القياسات المستلمة", link: "الربط", l_usb: "كابل USB", l_wifi: "واي فاي",
      sensor: "مستشعر التربة", s_ok: "يستجيب", s_bad: "لا يستجيب",
      sig: ["ضعيفة جدا", "ضعيفة", "متوسطة", "جيدة", "ممتازة"],
      ago_s: "منذ {n} ثانية", ago_m: "منذ {n} دقيقة", ago_h: "منذ {n} ساعة", never: "أبدا",
      up_m: "{n} دقيقة", up_h: "{n} ساعة", up_d: "{n} أيام",
      live_title: "قياسات المستشعر مباشرة", upd: "تحديث {t}",
      lo: "منخفض", hi: "مرتفع", good: "جيد", dry: "جاف", wet: "رطب جدا", salty: "مالح جدا", weather: "حسب الطقس المحلي",
      tiles: { soil_moisture: "رطوبة التربة", soil_temp: "حرارة التربة", soil_ph: "pH", soil_ec: "الملوحة (EC)", n: "الآزوت (N)", p: "الفوسفور (P)", k: "البوتاسيوم (K)", air_temp: "حرارة الهواء", air_humidity: "رطوبة الهواء" },
      steps_title: "ربط الجهاز", m_usb: "بكابل USB", m_wifi: "بالواي فاي",
      u1: "صِل البطاقة بالحاسوب", u1d: "بكابل USB، وبرنامج المستشعر داخل البطاقة. يبقى المستشعر موصولا بـ 12 فولت.",
      u2: "أغلق الشاشة التسلسلية", u2d: "في برنامج Arduino، أغلق الشاشة التسلسلية، وإلا فإنها تحجز الكابل.",
      u3: "هذا كل شيء!", u3d: "يجد النظام البطاقة تلقائيا ويعرض القياسات هنا خلال ثوانٍ. للتحكم في المضخة أو لوضع الجهاز بعيدا عن الحاسوب، استعمل الواي فاي.",
      s1: "صِل الجهاز بالكهرباء", s1d: "الضوء الصغير يومض بسرعة: الجهاز يبحث عن الواي فاي.",
      s2: "خذ هاتفك", s2d: "افتح إعدادات الواي فاي في الهاتف واختر هذه الشبكة:",
      network: "الشبكة", password: "كلمة السر",
      s3: "انسخ هذين الرمزين", s3d: "تفتح صفحة على الهاتف. اختر شبكة الواي فاي في المنزل، ثم الصق هذين الرمزين.",
      address: "العنوان", key: "المفتاح السري", copy: "نسخ", copied: "تم النسخ!", show: "إظهار", hide: "إخفاء",
      done: "هذا كل شيء! عندما يومض الضوء ببطء، كل شيء يعمل.",
      led_title: "ماذا يعني الضوء الصغير؟",
      led_slow: "يومض ببطء: كل شيء على ما يرام", led_fast: "يومض بسرعة: لا يوجد واي فاي",
      led_double: "وميض مزدوج: الحاسوب لا يستجيب", led_fixed: "مضاء باستمرار: السقي جارٍ",
      trouble: "لا يعمل؟", trouble_d: "اضغط 3 ثوانٍ على زر BOOT في الجهاز، ثم أعد من الخطوة 2.",
      trouble_usb: "افصل كابل USB ثم أعد وصله، وتأكد أن الشاشة التسلسلية في Arduino مغلقة.",
      tech: "للتقني",
    },
  };

  const TILES = [
    { k: "soil_moisture", unit: "%", d: 1, c: "var(--water)" },
    { k: "soil_temp", unit: "°C", d: 1, c: "var(--clay)" },
    { k: "soil_ph", unit: "", d: 1, c: "#8b6fd6" },
    { k: "soil_ec", unit: "dS/m", d: 2, c: "var(--ochre)" },
    { k: "n", unit: "mg/kg", d: 0, c: "#3f9d5a" },
    { k: "p", unit: "mg/kg", d: 0, c: "#c77d2e" },
    { k: "k", unit: "mg/kg", d: 0, c: "#4a7fc1" },
    { k: "air_temp", unit: "°C", d: 1, c: "var(--ink-3)" },
    { k: "air_humidity", unit: "%", d: 0, c: "var(--ink-3)" },
  ];

  let lang = "fr", info = null, timer = null, keyVisible = false, linkChoice = null, lastTs = null;
  try { lang = localStorage.getItem("saqiya-lang") === "ar" ? "ar" : "fr"; } catch { /* préférence non disponible */ }
  const t = (k, n) => String(T[lang][k] ?? T.fr[k] ?? k).replace("{n}", n).replace("{t}", n);
  const tx = (k) => T[lang][k] ?? T.fr[k];   // valeurs non textuelles (listes, objets)
  const bx = $("#bx");

  function applyLang() {
    bx.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    bx.setAttribute("lang", lang);
    $$("[data-t]", bx).forEach((el) => (el.textContent = t(el.dataset.t)));
    $$(".bx-lang button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lang === lang)));
    if (info) render();
  }
  if (window.LANG) lang = window.LANG;
  $$(".bx-lang button").forEach((b) => b.addEventListener("click", () => window.setLang(b.dataset.lang)));
  const prevHook = window.onLangChange;
  window.onLangChange = () => { prevHook?.(); lang = window.LANG; applyLang(); };

  const ago = (ts) => {
    if (!ts) return t("never");
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 60) return t("ago_s", Math.round(s));
    if (s < 3600) return t("ago_m", Math.round(s / 60));
    if (s < 86400) return t("ago_h", Math.round(s / 3600));
    return dayHm(ts);
  };
  const uptime = (s) => s == null ? "—" : s < 3600 ? t("up_m", Math.round(s / 60)) : s < 86400 ? t("up_h", Math.round(s / 3600)) : t("up_d", Math.round(s / 86400));
  const sigBars = (rssi) => rssi == null ? 0 : rssi >= -55 ? 4 : rssi >= -67 ? 3 : rssi >= -75 ? 2 : rssi >= -85 ? 1 : 0;

  // avis simple sur chaque mesure, d'après la culture et les seuils agronomiques
  function judge(k, v) {
    if (v == null) return ["", "na"];
    const ph = info.crop?.ph || [6, 7], ec = info.crop?.ec_max ?? 2.5, nut = info.nutrients || {};
    const range = (lo, hi, low = t("lo"), high = t("hi")) => v < lo ? [low, "low"] : v > hi ? [high, "high"] : [t("good"), "ok"];
    if (k === "soil_moisture") return range(20, 70, t("dry"), t("wet"));
    if (k === "soil_ph") return range(ph[0], ph[1]);
    if (k === "soil_ec") return v > ec ? [t("salty"), "high"] : [t("good"), "ok"];
    if (k === "n" || k === "p" || k === "k") { const r = nut[k.toUpperCase()]; return r ? range(r.low, r.high) : ["", "na"]; }
    if (k === "air_temp" || k === "air_humidity") return [t("weather"), "na"];
    return ["", "na"];
  }

  function renderLive(main) {
    const r = main?.latest;
    $("#bx-live").hidden = !r;
    if (!r) return;
    const fresh = r.ts !== lastTs && lastTs !== null;
    lastTs = r.ts;
    const ageEl = $("#bx-live-ago");
    ageEl.textContent = t("upd", ago(r.ts));
    ageEl.classList.toggle("stale", Date.now() / 1000 - r.ts > 600);
    $("#bx-tiles").innerHTML = TILES.filter((o) => r[o.k] != null).map((o, i) => {
      const [txt, cls] = o.k.startsWith("air") && r.air_source !== "meteo" ? ["", "na"] : judge(o.k, r[o.k]);
      return `<div class="bx-tile ${fresh ? "flash" : ""}" style="--c:${o.c};animation-delay:${i * 40}ms">
        <span class="t">${esc(tx("tiles")[o.k])}</span>
        <span class="v">${num(r[o.k], o.d)}${o.unit ? `<small>${o.unit}</small>` : ""}</span>
        <span class="s ${cls}">${esc(txt)}${o.k === "soil_ec" ? ` · ${num(r[o.k] * 1000, 0)} µS/cm` : ""}</span>
      </div>`;
    }).join("");
  }

  function render() {
    const real = info.devices.filter((d) => !d.simulated);
    const main = real[0] || null;
    const usb = info.usb || {};
    const simOnline = info.devices.some((d) => d.simulated && d.online);
    let state = main ? (main.online ? "ok" : "off") : simOnline ? "sim" : "wait";
    if (usb.connected && (!main || !main.online)) state = "usbwait";
    bx.dataset.state = state === "usbwait" ? "wait" : state;

    // liaison : celle du boîtier réel, sinon USB si une carte est branchée, sinon le choix de l'utilisateur
    const autoLink = main ? (main.usb ? "usb" : "wifi") : usb.connected ? "usb" : "usb";
    const link = linkChoice || autoLink;
    bx.dataset.link = link;
    bx.classList.toggle("usb", main ? !!main.usb : !!usb.connected || link === "usb");
    $$(".bx-mode button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.link === link)));

    $("#bx-badge").textContent = t("st_" + state);
    $("#bx-title").textContent = t(state);
    const sub = state === "usbwait" ? t("usbwait_d", usb.port || "USB")
      : state === "ok" && main.sensor_ok === 0 ? t("sensor_bad")
      : t(state + "_d", main ? ago(main.latest?.ts || main.last_seen) : "");
    $("#bx-sub").textContent = sub;

    // port USB occupé (moniteur série ouvert) : message clair
    const busy = usb.available && !usb.connected && usb.error && /denied|refus|busy|occup|PermissionError|Access/i.test(usb.error);
    const alertEl = $("#bx-alert");
    alertEl.hidden = !busy;
    if (busy) alertEl.innerHTML = `<b>!</b><span>${esc(t("busy", (usb.error.match(/COM\d+/) || ["USB"])[0]))}</span>`;

    if (main) {
      const facts = [];
      facts.push(`<div><span>${t("link")}</span><b>${main.usb ? `${t("l_usb")} · ${esc(String(main.ip).slice(4))}` : t("l_wifi")}</b></div>`);
      if (main.sensor_ok != null) facts.push(`<div><span>${t("sensor")}</span><b class="${main.sensor_ok ? "good" : "bad"}">${t(main.sensor_ok ? "s_ok" : "s_bad")}</b></div>`);
      if (!main.usb) {
        const b = sigBars(main.rssi);
        facts.push(`<div><span>${t("signal")}</span><b><span class="sig">${[1, 2, 3, 4].map((i) => `<i class="${i <= b ? "on" : ""}" style="height:${i * 25}%"></i>`).join("")}</span>${main.rssi == null ? "—" : tx("sig")[b]}</b></div>`);
        if (main.uptime_s != null) facts.push(`<div><span>${t("since")}</span><b>${uptime(main.uptime_s)}</b></div>`);
      }
      facts.push(`<div><span>${t("count")}</span><b>${main.readings}</b></div>`);
      $("#bx-facts").innerHTML = facts.join("");
    } else if (usb.connected) {
      $("#bx-facts").innerHTML = `<div><span>${t("link")}</span><b>${t("l_usb")} · ${esc(usb.port || "")}</b></div>`;
    } else {
      $("#bx-facts").innerHTML = "";
    }
    renderLive(main);

    $("#bx-url").textContent = info.server_urls[0] || "—";
    $("#bx-key").textContent = keyVisible ? info.key : "•".repeat(12);
    $("#bx-show i").textContent = t(keyVisible ? "hide" : "show");

    $("#bx-list").innerHTML = info.devices.length ? info.devices.map((d) => `
      <li><span class="dot ${d.online ? "on" : "off"}"></span>
        <div><b>${esc(d.id)}</b>${d.simulated ? ` <span class="tag">${d.id === "historique-demo" ? "démonstration" : "simulateur"}</span>` : ` <span class="tag real">boîtier réel</span>`}
          <small>${esc(d.ip || "—")} · programme ${esc(d.fw || "v1")}${d.sensor ? ` · capteur ${esc(d.sensor === "7en1" ? "7-en-1 RS485" : d.sensor)}` : ""}${d.usb ? "" : ` · ${d.rssi ?? "—"} dBm`} · ${d.readings} mesures</small></div></li>`).join("")
      : `<li><small>Aucun boîtier n'a encore contacté le serveur.</small></li>`;
    $("#bx-usb-diag").innerHTML = !usb.available ? "Lecture USB inactive : installez-la avec <code>python -m pip install pyserial</code> puis relancez le serveur."
      : usb.connected ? `Lecture USB active sur <code>${esc(usb.port)}</code> · dernière ligne reçue : <code>${esc(usb.last_line || "—")}</code>`
      : `Lecture USB : aucune carte ESP32 branchée${usb.error ? ` (dernier problème : ${esc(usb.error)})` : ""}.`;
  }

  async function load() {
    try { info = await api("/api/device"); render(); } catch { /* serveur injoignable : indiqué dans la barre latérale */ }
  }
  window.loadDevice = function () {
    applyLang();
    load();
    clearInterval(timer);
    timer = setInterval(() => { if ($("#view-device").classList.contains("active")) load(); else clearInterval(timer); }, 3000);
  };

  $$(".bx-mode button").forEach((b) => b.addEventListener("click", () => { linkChoice = b.dataset.link; if (info) render(); }));
  $("#bx-show").addEventListener("click", () => { keyVisible = !keyVisible; if (info) render(); });
  bx.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b || !info) return;
    const what = b.dataset.copy;
    const text = what === "key" ? info.key : what === "url" ? info.server_urls[0] : $("#fw-cmd").textContent;
    try {
      await navigator.clipboard.writeText(text);
      const label = b.querySelector("i");
      b.classList.add("copied");
      if (label) label.textContent = t("copied");
      setTimeout(() => { b.classList.remove("copied"); if (label) label.textContent = t("copy"); }, 1600);
    } catch {
      toast(lang === "ar" ? "تعذر النسخ: حدد النص يدويا" : "Copie impossible : sélectionnez le texte à la main");
    }
  });
  $("#bx-newkey").addEventListener("click", async () => {
    if (!info?.default_key && !confirm("Générer une nouvelle clé ? Le boîtier sera refusé jusqu'à ce que la nouvelle clé soit saisie dans son portail.")) return;
    info = await api("/api/device/key", { method: "POST", body: "{}" });
    keyVisible = true;
    render();
    toast("Nouvelle clé générée");
  });
  $("#bx-reset").addEventListener("click", async () => {
    if (prompt("Mesures, arrosages et alertes seront effacés (une sauvegarde est créée).\nTapez EFFACER pour confirmer :") !== "EFFACER") return;
    const r = await api("/api/data/reset", { method: "POST", body: JSON.stringify({ confirm: "EFFACER" }) });
    toast("Mesures effacées · sauvegarde : " + r.backup);
    load();
    refresh();
  });
  applyLang();
})();
