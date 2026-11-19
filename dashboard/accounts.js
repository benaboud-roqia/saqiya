/* Sāqiya — utilisateur connecté (barre latérale), déconnexion, ouverture des comptes (propriétaire). */
(function () {
  let me = null;
  const initial = (u) => (u.name || u.email || "?").trim().charAt(0).toUpperCase();
  const avatar = (u, cls) => u.picture
    ? `<img class="${cls}" src="${encodeURI(u.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${cls}">${esc(initial(u))}</span>`;

  async function loadMe() {
    const r = await fetch("/api/auth/me", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    me = r?.user;
    if (!me || me.status !== "active") { location.replace("/login?next=/app/"); return; }
    $("#me").hidden = false;
    $("#me-av").outerHTML = avatar(me, "me-av");
    $("#me-name").textContent = me.name || me.email;
    $("#me-role").textContent = me.role === "owner" ? "Propriétaire" : "Membre";
    $("#acc").hidden = me.role !== "owner";
    document.body.dataset.role = me.role;
  }

  $("#me-out").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    location.replace("/login");
  });

  function renderUsers(data) {
    const list = data.users || [];
    $("#acc-list").innerHTML = list.map((u) => {
      const self = u.id === data.me, pending = u.status !== "active";
      const how = [u.has_google ? "Google" : "", u.has_password ? "e-mail" : ""].filter(Boolean).join(" + ");
      return `<li class="${pending ? "pending" : ""}">
        ${avatar(u, "acc-av")}
        <div class="acc-who"><b>${esc(u.name || u.email)}</b><small>${esc(u.email)} · ${how}</small></div>
        <span class="acc-tag ${u.role === "owner" ? "owner" : pending ? "wait" : "ok"}">${u.role === "owner" ? "Propriétaire" : pending ? "En attente" : "Compte ouvert"}</span>
        <div class="acc-act">${self || u.role === "owner" ? "" : pending
          ? `<button type="button" class="btn btn-ink" data-act="approve" data-id="${u.id}">Ouvrir le compte</button><button type="button" class="btn btn-line" data-act="delete" data-id="${u.id}">Refuser</button>`
          : `<button type="button" class="btn btn-line" data-act="suspend" data-id="${u.id}">Suspendre</button><button type="button" class="btn btn-line" data-act="delete" data-id="${u.id}">Supprimer</button>`}</div>
      </li>`;
    }).join("");
    const waiting = list.filter((u) => u.status !== "active").length;
    const nav = document.querySelector('.nav[data-view="settings"]');
    nav.dataset.badge = waiting || "";
  }

  async function loadUsers() {
    if (me?.role !== "owner") return;
    renderUsers(await api("/api/users"));
  }
  window.loadAccounts = loadUsers;

  $("#acc-list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "delete" && !confirm("Supprimer ce compte ? La personne ne pourra plus se connecter.")) return;
    renderUsers(await api(`/api/users/${b.dataset.id}/${b.dataset.act}`, { method: "POST", body: "{}" }));
    toast(b.dataset.act === "approve" ? "Compte ouvert" : b.dataset.act === "suspend" ? "Compte suspendu" : "Compte supprimé");
  });

  // la liste se met à jour à l'ouverture des Paramètres et toutes les 30 s (nouvelles inscriptions)
  const nav = document.querySelector('.nav[data-view="settings"]');
  nav.addEventListener("click", () => setTimeout(loadUsers, 50));
  loadMe().then(loadUsers);
  setInterval(() => { if (me?.role === "owner") api("/api/users").then(renderUsers).catch(() => {}); }, 30000);
})();
