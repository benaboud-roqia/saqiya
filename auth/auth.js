/* Sāqiya — connexion / inscription (e-mail + Google), attente de validation, français / arabe */
(function () {
  const $ = (s) => document.querySelector(s);
  const T = {
    fr: {
      pitch: "Votre parcelle,", pitch_hl: "au bon moment.", pitch_d: "Connectez-vous pour suivre l'humidité du sol, l'arrosage et la santé de vos cultures.",
      badge: "Agriculture intelligente",
      f1: "Capteur 7-en-1", f1d: "Humidité, pH, EC, N, P, K en direct",
      f2: "Arrosage automatique", f2d: "Au bon moment, selon le sol et la météo",
      f3: "Santé des cultures", f3d: "Maladies prévues avant les symptômes",
      live_soil: "Sol en ce moment", live_air: "Air", live_pump: "Pompe", on: "en marche", off: "au repos",
      back: "← Retour au site", lang: "العربية",
      login_t: "Bon retour", login_s: "Connectez-vous pour ouvrir le tableau de bord.",
      reg_t: "Créer un compte", reg_s: "Quelques secondes suffisent : vous entrez directement dans le tableau de bord.",
      owner_t: "Créer le compte propriétaire", owner_s: "Premier compte du système : vous en serez le propriétaire et pourrez ouvrir les comptes des autres.",
      tab_login: "Connexion", tab_register: "Inscription", google: "Continuer avec Google",
      google_off: "La connexion avec Gmail sera disponible dès que son identifiant Google sera ajouté au serveur.",
      google_here: "Sur cette adresse en ligne, connectez-vous avec votre e-mail et votre mot de passe. La connexion Gmail fonctionne sur le PC de la parcelle.",
      or: "ou avec votre e-mail", name: "Votre nom", email: "Adresse e-mail", password: "Mot de passe",
      submit_login: "Se connecter", submit_reg: "Créer mon compte",
      foot_login: "Pas encore de compte ?", foot_reg: "Déjà un compte ?", go_reg: "Inscrivez-vous", go_login: "Connectez-vous",
      s1: "Trop faible", s2: "Moyen", s3: "Bon", s4: "Excellent",
      e_email: "Saisissez une adresse e-mail valide.", e_name: "Saisissez votre nom.", e_pw: "Au moins 8 caractères, avec lettres et chiffres.",
      e_net: "Le serveur ne répond pas. Réessayez.",
      wait_title: "Votre compte est en attente", wait_d: "Le propriétaire de la parcelle doit ouvrir votre compte. Cette page s'ouvrira toute seule dès que ce sera fait.",
      wait_check: "Vérification automatique…", logout: "Se déconnecter",
    },
    ar: {
      pitch: "حقلك،", pitch_hl: "في الوقت المناسب.", pitch_d: "سجّل الدخول لمتابعة رطوبة التربة والسقي وصحة زراعاتك.",
      badge: "فلاحة ذكية",
      f1: "مستشعر 7 في 1", f1d: "الرطوبة، pH، الملوحة، N، P، K مباشرة",
      f2: "سقي تلقائي", f2d: "في الوقت المناسب حسب التربة والطقس",
      f3: "صحة المزروعات", f3d: "توقع الأمراض قبل ظهور الأعراض",
      live_soil: "التربة الآن", live_air: "الهواء", live_pump: "المضخة", on: "تعمل", off: "متوقفة",
      back: "→ العودة إلى الموقع", lang: "Français",
      login_t: "مرحبا بعودتك", login_s: "سجّل الدخول لفتح لوحة التحكم.",
      reg_t: "إنشاء حساب", reg_s: "بضع ثوانٍ تكفي: تدخل مباشرة إلى لوحة التحكم.",
      owner_t: "إنشاء حساب المالك", owner_s: "أول حساب في النظام: ستكون المالك ويمكنك تفعيل حسابات الآخرين.",
      tab_login: "تسجيل الدخول", tab_register: "التسجيل", google: "المتابعة مع Google",
      google_off: "سيتوفر الدخول عبر Gmail بمجرد إضافة معرّف Google إلى الخادم.",
      google_here: "على هذا العنوان، سجّل الدخول ببريدك الإلكتروني وكلمة المرور. الدخول عبر Gmail يعمل على حاسوب المزرعة.",
      or: "أو ببريدك الإلكتروني", name: "اسمك", email: "البريد الإلكتروني", password: "كلمة السر",
      submit_login: "دخول", submit_reg: "إنشاء حسابي",
      foot_login: "ليس لديك حساب؟", foot_reg: "لديك حساب؟", go_reg: "سجّل الآن", go_login: "سجّل الدخول",
      s1: "ضعيفة جدا", s2: "متوسطة", s3: "جيدة", s4: "ممتازة",
      e_email: "أدخل بريدا إلكترونيا صحيحا.", e_name: "أدخل اسمك.", e_pw: "8 أحرف على الأقل مع حروف وأرقام.",
      e_net: "الخادم لا يستجيب. أعد المحاولة.",
      wait_title: "حسابك في الانتظار", wait_d: "يجب على صاحب الحقل تفعيل حسابك. ستُفتح هذه الصفحة تلقائيا بمجرد ذلك.",
      wait_check: "تحقق تلقائي…", logout: "تسجيل الخروج",
    },
  };
  // messages du serveur traduits en arabe
  const SERVER_AR = {
    "Adresse e-mail ou mot de passe incorrect.": "البريد الإلكتروني أو كلمة السر غير صحيحة.",
    "Un compte existe déjà avec cette adresse. Connectez-vous.": "يوجد حساب بهذا العنوان. سجّل الدخول.",
    "Trop d'essais. Réessayez dans 10 minutes.": "محاولات كثيرة. أعد المحاولة بعد 10 دقائق.",
    "Nom ou adresse e-mail invalide.": "الاسم أو البريد الإلكتروني غير صحيح.",
    "Le mot de passe doit faire au moins 8 caractères.": "يجب أن تتكون كلمة السر من 8 أحرف على الأقل.",
    "Le mot de passe doit mélanger lettres et chiffres.": "يجب أن تجمع كلمة السر بين الحروف والأرقام.",
    "Google n'a pas validé la connexion.": "لم تؤكد Google تسجيل الدخول.",
    "Adresse Gmail non vérifiée.": "عنوان Gmail غير مؤكد.",
  };

  let lang = "fr";
  try { lang = localStorage.getItem("saqiya-lang") === "ar" ? "ar" : "fr"; } catch { /* préférence indisponible */ }
  let tab = "login", cfg = { google_client_id: "", has_users: true }, waitTimer = null;
  const next = (() => { const n = new URLSearchParams(location.search).get("next") || "/app/"; return /^\/app(\/|$)/.test(n) ? n : "/app/"; })();
  const t = (k) => T[lang][k] ?? T.fr[k] ?? k;

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
    const lb = $("#au-lang"); lb.textContent = t("lang"); lb.lang = lang === "ar" ? "fr" : "ar";
    setTab(tab, true);
    renderGoogle();
  }
  $("#au-lang").addEventListener("click", () => {
    lang = lang === "ar" ? "fr" : "ar";
    try { localStorage.setItem("saqiya-lang", lang); } catch { /* idem */ }
    applyLang();
  });

  /* ---------- onglets ---------- */
  function setTab(name, silent) {
    tab = name;
    $("#tabs").dataset.on = name;
    document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    const reg = name === "register";
    $("#fld-name").hidden = !reg;
    $("#meter").hidden = !reg;
    const owner = reg && !cfg.has_users;
    $("#f-title").textContent = t(owner ? "owner_t" : reg ? "reg_t" : "login_t");
    $("#f-sub").textContent = t(owner ? "owner_s" : reg ? "reg_s" : "login_s");
    $("#submit-t").textContent = t(reg ? "submit_reg" : "submit_login");
    $("#f").password.autocomplete = reg ? "new-password" : "current-password";
    $("#f-foot").innerHTML = `${t(reg ? "foot_reg" : "foot_login")} <button type="button" class="au-link" id="swap">${t(reg ? "go_login" : "go_reg")}</button>`;
    $("#swap").onclick = () => setTab(reg ? "login" : "register");
    if (!silent) { $("#err").hidden = true; (reg ? $("#f").name : $("#f").email).focus(); }
  }
  document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  /* ---------- mot de passe ---------- */
  $("#eye").addEventListener("click", () => {
    const i = $("#f").password, show = i.type === "password";
    i.type = show ? "text" : "password";
    $("#eye").classList.toggle("on", show);
  });
  $("#f").password.addEventListener("input", (e) => {
    const v = e.target.value;
    let s = 0;
    if (v.length >= 8) s++;
    if (/[a-zA-Z]/.test(v) && /\d/.test(v)) s++;
    if (v.length >= 12) s++;
    if (/[^a-zA-Z0-9]/.test(v) || /[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    s = v ? Math.max(1, s) : 0;
    $("#meter").dataset.s = s;
    $("#meter-t").textContent = s ? t("s" + s) : "";
  });

  /* ---------- envoi ---------- */
  function showErr(msg) {
    const e = $("#err");
    e.textContent = lang === "ar" ? (SERVER_AR[msg] || msg) : msg;
    e.hidden = false;
    e.style.animation = "none"; void e.offsetWidth; e.style.animation = "";
  }
  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || t("e_net"));
    return data;
  }
  function done(user) {
    if (user && user.status === "active") location.replace(next);
    else showWait(user);
  }
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, reg = tab === "register";
    const email = f.email.value.trim(), pw = f.password.value, name = f.name.value.trim();
    [f.email, f.password, f.name].forEach((i) => i.removeAttribute("aria-invalid"));
    if (reg && !name) { f.name.setAttribute("aria-invalid", "true"); return showErr(t("e_name")); }
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email)) { f.email.setAttribute("aria-invalid", "true"); return showErr(t("e_email")); }
    if (reg && (pw.length < 8 || !/\d/.test(pw) || !/[a-zA-Z؀-ۿ]/.test(pw))) { f.password.setAttribute("aria-invalid", "true"); return showErr(t("e_pw")); }
    $("#submit").classList.add("busy");
    try {
      const r = await post(reg ? "/api/auth/register" : "/api/auth/login", reg ? { name, email, password: pw } : { email, password: pw });
      done(r.user);
    } catch (err) {
      showErr(err.message);
    } finally {
      $("#submit").classList.remove("busy");
    }
  });

  /* ---------- Google ---------- */
  let gisLoaded = false;
  function renderGoogle() {
    const cid = cfg.google_client_id;
    // adresse non autorisée dans Google Cloud Console : Google répondrait « Accès bloqué » → pas de bouton
    const allowed = !cfg.google_origins || cfg.google_origins.includes(location.origin);
    const relay = cid && !allowed && cfg.google_relay;      // adresse en ligne : connexion Google via la page à adresse fixe
    const note = $("#g-note");
    note.setAttribute("data-t", cid && !allowed && !relay ? "google_here" : "google_off");
    note.textContent = t(note.getAttribute("data-t"));
    $("#g-fake").hidden = !!cid && !relay;
    $("#g-fake").classList.toggle("relay", !!relay);
    $("#g-fake").onclick = relay ? () => { location.href = cfg.google_relay + "?lang=" + lang; } : null;
    note.hidden = !!cid && (allowed || !!relay);
    const sep = document.querySelector(".au-or"); if (sep) sep.hidden = !!cid && !allowed && !relay;
    if (!cid || !allowed) { $("#g-btn").innerHTML = ""; return; }
    const draw = () => {
      if (!window.google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: cid,
        callback: async (resp) => {
          try { const r = await post("/api/auth/google", { credential: resp.credential }); done(r.user); }
          catch (err) { showErr(err.message); }
        },
      });
      // largeur réelle de la carte (sur téléphone le bouton ne doit jamais dépasser l'écran)
      const card = document.querySelector(".au-card");
      const room = (card ? card.clientWidth - 48 : 0) || Math.min(window.innerWidth - 64, 360);
      const w = Math.max(200, Math.min(400, room));
      $("#g-btn").innerHTML = "";
      google.accounts.id.renderButton($("#g-btn"), {
        theme: "outline",
        size: "large", shape: "pill", width: w, text: tab === "register" ? "signup_with" : "continue_with", locale: lang,
      });
    };
    if (gisLoaded) return draw();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => { gisLoaded = true; draw(); };
    s.onerror = () => { $("#g-fake").hidden = false; };
    document.head.appendChild(s);
  }

  /* ---------- attente de validation ---------- */
  function showWait(user) {
    $("#v-form").hidden = true;
    $("#v-wait").hidden = false;
    const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
    $("#who").innerHTML = (user?.picture ? `<img src="${encodeURI(user.picture)}" alt="" referrerpolicy="no-referrer">` : `<span class="av">${initial}</span>`) +
      `<span></span>`;
    $("#who span:last-child").textContent = user?.email || "";
    clearInterval(waitTimer);
    waitTimer = setInterval(async () => {
      const r = await fetch("/api/auth/me", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r?.user?.status === "active") location.replace(next);
      if (r && !r.user) location.reload();
    }, 5000);
  }
  $("#logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    location.reload();
  });

  /* ---------- parcelle en direct ---------- */
  async function live() {
    try {
      const s = await fetch("/api/public/summary", { cache: "no-store" }).then((r) => r.json());
      if (!s.ts) return;
      const fmt = (v) => (v == null ? "—" : (+v).toFixed(1).replace(".", ","));
      $("#lv-soil").textContent = fmt(s.soil_moisture) + " %";
      $("#lv-air").textContent = fmt(s.air_temp) + " °C";
      $("#lv-pump").textContent = t(s.pump_on ? "on" : "off");
      $("#au-live").hidden = false;
    } catch { /* pas d'aperçu */ }
  }

  /* ---------- démarrage ---------- */
  (async () => {
    // retour de la page Google à adresse fixe : #g=<jeton> (le fragment n'est jamais envoyé sur le réseau)
    if (location.hash.startsWith("#g=")) {
      const cred = decodeURIComponent(location.hash.slice(3));
      history.replaceState(null, "", location.pathname + location.search);
      try { const r = await post("/api/auth/google", { credential: cred }); return done(r.user); }
      catch (err) { setTimeout(() => showErr(err.message), 400); }
    }
    const [me, c] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/auth/config", { cache: "no-store" }).then((r) => r.json()).catch(() => cfg),
    ]);
    cfg = c;
    if (me.user?.status === "active") return location.replace(next);
    tab = cfg.has_users ? "login" : "register";
    applyLang();
    if (me.user) showWait(me.user);
    live();
  })();
})();
