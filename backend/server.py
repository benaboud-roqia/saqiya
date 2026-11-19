"""Serveur Backend du système d'irrigation intelligent (API REST + tableau de bord).

Lancement :  python backend/server.py        puis ouvrir http://localhost:8000
Aucune dépendance obligatoire (bibliothèque standard Python). Le paquet « anthropic »
est optionnel et active le chatbot complet.
"""
import base64
import binascii
import json
import re
import mimetypes
import os
import secrets
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import envfile  # noqa: E402

ENV_LOADED = envfile.load()   # clés (GROQ_API_KEY…) lues dans smart_irrigation/.env

import database as db  # noqa: E402

db.init()
db.close_interrupted_events()

import auth  # noqa: E402
import notifier  # noqa: E402
import vision  # noqa: E402
import llm  # noqa: E402
import chatbot  # noqa: E402
import disease  # noqa: E402
import irrigation  # noqa: E402
import knowledge  # noqa: E402
import soil  # noqa: E402
import usb_bridge  # noqa: E402
import weather  # noqa: E402

DASHBOARD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dashboard"))
SITE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "site"))
AUTH_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "auth"))
PORT = int(os.environ.get("PORT", 8000))

# plages physiquement plausibles : les valeurs hors plage sont ignorées
RANGES = {
    "soil_moisture": (0, 100), "soil_temp": (-20, 70), "soil_ph": (0, 14), "soil_ec": (0, 30),
    "n": (0, 2000), "p": (0, 2000), "k": (0, 5000),
    "air_temp": (-40, 70), "air_humidity": (0, 100), "rain_detected": (0, 1),
}

_disease_cache = {}   # un calcul de risques par compte
_disease_lock = threading.Lock()


def clean_reading(payload):
    payload = dict(payload)
    # capteurs 7-en-1 : conductivité en µS/cm → dS/m (= mS/cm)
    if payload.get("soil_ec") in (None, "") and payload.get("soil_ec_us") not in (None, ""):
        try:
            payload["soil_ec"] = float(payload["soil_ec_us"]) / 1000.0
        except (TypeError, ValueError):
            pass
    out = {}
    for field, (lo, hi) in RANGES.items():
        v = payload.get(field)
        if v is None or v == "":
            continue
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        if lo <= v <= hi:
            out[field] = int(v) if field == "rain_detected" else round(v, 2)
    return out


def get_weather(settings):
    return weather.forecast(settings["latitude"], settings["longitude"])


def disease_status(force=False):
    with _disease_lock:
        hit = _disease_cache.get(db.uid())
        if force or not hit or time.time() - hit["ts"] > 60:
            hit = {"data": disease.assess(), "ts": time.time()}
            _disease_cache[db.uid()] = hit
        return hit["data"]


def lan_addresses():
    """Adresses IPv4 du PC sur le réseau local (celle de la route par défaut en premier)."""
    ips = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))   # aucun paquet n'est envoyé (UDP sans données)
            ips.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return [ip for ip in ips if not ip.startswith(("127.", "169.254."))]


def device_info():
    settings = db.get_settings()
    now = time.time()
    devices = [d for d in db.list_devices() if d["id"] not in db.DEMO_DEVICES]   # seul le vrai matériel
    for d in devices:
        d["online"] = now - (d["last_seen"] or 0) < 120
        d["simulated"] = d["id"] in db.DEMO_DEVICES
        d["usb"] = str(d.get("ip") or "").startswith("USB")
        if not d["simulated"]:
            d["latest"] = db.latest_reading_for(d["id"])
    return {
        "devices": devices,
        "server_urls": [f"http://{ip}:{PORT}" for ip in lan_addresses()],
        "key": settings["device_key"],
        "usb": usb_bridge.status,
        "crop": {k: knowledge.crop(settings["crop"]).get(k) for k in ("ph", "ec_max", "label")},
        "nutrients": {k: {"low": v["low"], "high": v["high"]} for k, v in knowledge.KB["nutrients"].items()},
        "default_key": settings["device_key"] == "change-me",
    }


def public_settings(s):
    s = dict(s)
    s["device_key"] = "********"
    s["telegram_configured"] = bool(s.get("telegram_token"))
    s["google_env"] = bool(os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("SAQIYA_GOOGLE_CLIENT_ID"))
    s["google_active"] = bool(auth.google_client_id())
    s["telegram_token"] = "********" if s.get("telegram_token") else ""
    s["ai_configured"] = vision.available()
    s["anthropic_api_key"] = "********" if s.get("anthropic_api_key") else ""
    s["groq_api_key"] = "********" if s.get("groq_api_key") else ""
    return s


def start_photo_analysis(pid):
    """Lance le diagnostic IA d'une photo dans un fil séparé (l'envoi de la photo reste instantané)."""
    db.set_photo_analysis(pid, "pending")
    owner = db.uid()

    def run():
        db.set_uid(owner)              # le fil d'analyse travaille sur la parcelle du compte
        photo = db.get_photo(pid)
        try:
            ctx = chat_context()
            result = vision.analyze(photo, {k: ctx.get(k) for k in ("latest_reading", "weather", "disease", "thresholds", "culture", "type_de_sol")})
            db.set_photo_analysis(pid, "done", result)
            top = (result.get("diagnoses") or [None])[0]
            if result.get("status") == "malade" and top and result.get("urgency") in ("moyenne", "haute"):
                db.add_alert("photo", "danger" if result["urgency"] == "haute" else "warning",
                             f"Photo : {top['name_fr']} probable ({top['confidence']} %)", result.get("summary_fr", ""))
        except Exception as e:
            cause = e.__cause__ or e.__context__
            print(f"[photos] diagnostic impossible : {e!r} — cause : {cause!r}")
            a = vision.anthropic
            msg = ("Clé Claude refusée : vérifiez-la dans Réglages › IA." if a and isinstance(e, a.AuthenticationError) else
                   "Crédit Claude épuisé ou limite atteinte : réessayez plus tard." if a and isinstance(e, (a.RateLimitError, a.PermissionDeniedError)) else
                   "Pas de connexion à Internet : réessayez dans un instant." if a and isinstance(e, a.APIConnectionError) else
                   str(e)[:200])
            db.set_photo_analysis(pid, "error", {"error": msg})

    threading.Thread(target=run, daemon=True).start()


def costs(seconds, settings):
    """Litres, m³, kWh et coût estimé pour une durée de pompage."""
    litres = seconds / 60 * float(settings["pump_flow_lpm"])
    kwh = seconds / 3600 * float(settings["pump_power_kw"])
    water_cost = litres / 1000 * float(settings["water_price_m3"])
    elec_cost = kwh * float(settings["electricity_price_kwh"])
    return {"litres": round(litres), "m3": round(litres / 1000, 2), "kwh": round(kwh, 2),
            "water_cost": round(water_cost, 2), "elec_cost": round(elec_cost, 2),
            "total_cost": round(water_cost + elec_cost, 2), "currency": settings.get("currency", "DA")}


def build_report(t0, t1):
    settings = db.get_settings()
    data = db.report(t0, t1)
    total_s = sum(d.get("s") or 0 for d in data["days"])
    data["totals"] = {"irrigations": sum(d.get("n") or 0 for d in data["days"]), "seconds": total_s, **costs(total_s, settings)}
    for d in data["days"]:
        d.update(costs(d.get("s") or 0, settings))
    data["settings"] = {k: settings[k] for k in ("crop", "soil_type", "pump_flow_lpm", "pump_power_kw", "water_price_m3",
                                                 "electricity_price_kwh", "currency", "latitude", "longitude")}
    data["crop_label"] = knowledge.crop(settings["crop"])["label"]
    data["soil_label"] = knowledge.soil(settings["soil_type"])["label"]
    data["period"] = {"from": t0, "to": t1}
    # pour un rapport complet : exploitant, plages idéales, risques de maladies, diagnostics photo de la période
    me = db.user_by_id(db.uid()) or {}
    data["account"] = {"name": me.get("name") or "", "email": me.get("email") or ""}
    crop = knowledge.crop(settings["crop"])
    data["ideal"] = {"ph": crop.get("ph"), "ec_max": crop.get("ec_max"), "needs": crop.get("needs", ""),
                     "nutrients": {k: {"low": v["low"], "high": v["high"]} for k, v in knowledge.KB["nutrients"].items()}}
    dz = disease_status()
    data["diseases"] = [{"label": r["label"], "risk": r["risk"], "level": r["level"]} for r in (dz.get("risks") or [])][:6] \
        if dz.get("available") else []
    diag = []
    for p in db.list_photos():
        if not (t0 <= p["ts"] < t1) or p["kind"] in ("sol", "materiel"):
            continue
        a = p.get("analysis") or {}
        top = (a.get("diagnoses") or [None])[0] if p.get("analysis_status") == "done" else None
        diag.append({"ts": p["ts"], "status": a.get("status") if p.get("analysis_status") == "done" else None,
                     "name_fr": top.get("name_fr") if top else None, "name_ar": top.get("name_ar") if top else None,
                     "confidence": top.get("confidence") if top else None, "colors": p.get("colors")})
    data["diagnoses"] = diag[:20]
    data["report_id"] = f"SQ-{db.uid():03d}-{time.strftime('%Y%m%d', time.localtime(t1 - 1))}"
    return data


def _valid_hhmm(v):
    return isinstance(v, str) and len(v) == 5 and v[2] == ":" and v[:2].isdigit() and v[3:].isdigit() \
        and int(v[:2]) < 24 and int(v[3:]) < 60


def clean_schedule_settings(body):
    """Valide créneaux, arrosages programmés, notifications et coûts envoyés par le tableau de bord."""
    if "windows" in body:
        body["windows"] = [{"start": w["start"], "end": w["end"]} for w in (body["windows"] or [])[:6]
                           if _valid_hhmm(w.get("start")) and _valid_hhmm(w.get("end"))]
    if "schedules" in body:
        out = []
        for sc in (body["schedules"] or [])[:10]:
            if not _valid_hhmm(sc.get("time")):
                continue
            out.append({"time": sc["time"], "minutes": max(1, min(60, int(float(sc.get("minutes", 10))))),
                        "days": sorted({int(d) for d in sc.get("days", range(7)) if 0 <= int(d) <= 6}),
                        "only_if_dry": bool(sc.get("only_if_dry", True)), "on": bool(sc.get("on", True))})
        body["schedules"] = out
    if "windows_enabled" in body:
        body["windows_enabled"] = bool(body["windows_enabled"])
    if "notify" in body:
        body["notify"] = {k: bool((body["notify"] or {}).get(k, True)) for k in ("alerts", "pump", "offline", "daily")}
    if "notify_lang" in body:
        body["notify_lang"] = "ar" if body["notify_lang"] == "ar" else "fr"
    for k in ("water_price_m3", "pump_power_kw", "electricity_price_kwh"):
        if k in body:
            body[k] = max(0.0, float(body[k]))
    if "currency" in body:
        body["currency"] = str(body["currency"] or "DA").strip()[:6]
    body.pop("telegram_token", None)   # le jeton passe uniquement par /api/notify/detect
    body.pop("telegram_chats", None)
    return body


# ---------- tâches de fond : programmes, pompe, boîtier hors ligne, résumé du matin ----------
def background_loop():
    offline_sent, daily_sent = {}, None
    while True:
        try:
            for user_id in db.active_user_ids():          # chaque compte a sa parcelle, ses programmes et sa pompe
                with db.as_user(user_id):
                    try:
                        irrigation.pump_state()           # clôt un arrosage arrivé à échéance
                        irrigation.run_schedules(get_weather(db.get_settings()))
                    except Exception as e:
                        print(f"[tâches de fond] compte {user_id} : {e!r}")
            db.set_uid(None)                               # alertes Telegram et résumé : parcelle du propriétaire
            settings = db.get_settings()
            now = time.time()
            for d in db.list_devices(all_users=True):
                if d["id"] in db.DEMO_DEVICES or d.get("uid") != db.owner_id():
                    continue
                off = now - (d["last_seen"] or 0) > 600
                if off != offline_sent.get(d["id"], False) and (off or d["id"] in offline_sent):
                    notifier.offline_event(d["id"], off)
                offline_sent[d["id"]] = off
            t = time.localtime()
            today = time.strftime("%Y-%m-%d")
            if t.tm_hour == 7 and daily_sent != today and notifier.configured(settings):
                daily_sent = today
                notifier.daily_summary(build_status())
        except Exception as e:
            print(f"[tâches de fond] {e!r}")
        time.sleep(30)


def build_status():
    settings = db.get_settings()
    latest = db.latest_reading()
    threshold, target = irrigation.thresholds(settings, latest)
    w = get_weather(settings)
    return {
        "server_time": time.time(),
        "latest_reading": latest,
        "device_online": bool(latest and time.time() - latest["ts"] < 120),
        "has_device": db.real_device_active(),
        "pump": irrigation.pump_state(),
        "irrigation_decision": irrigation.last_decision(),
        "thresholds": {"threshold": threshold, "target": target},
        "next_irrigation": irrigation.predict_next_irrigation(settings),
        "water_24h": db.water_stats(),
        "weather": {k: v for k, v in w.items() if k != "hourly"},
        "disease": disease_status(),
        "soil_advice": soil.analyze(latest, settings, create_alerts=False),
        "open_alerts": len(db.list_alerts(200, only_open=True)),
        "settings": public_settings(settings),
        "crop": knowledge.crop(settings["crop"]),
        "llm_available": chatbot.llm_available(),
    }


def chat_context():
    st = build_status()
    keep = ["latest_reading", "pump", "irrigation_decision", "thresholds", "next_irrigation",
            "water_24h", "weather", "disease", "soil_advice", "crop"]
    ctx = {k: st[k] for k in keep}
    ctx["culture"] = st["settings"]["crop"]
    ctx["type_de_sol"] = knowledge.soil(st["settings"]["soil_type"])["label"]
    ctx["mode_irrigation"] = st["settings"]["mode"]
    ctx["heure_locale"] = time.strftime("%Y-%m-%d %H:%M")
    return ctx


class Handler(BaseHTTPRequestHandler):
    server_version = "SmartFarm/1.0"

    # ---------- utilitaires ----------
    def _json(self, data, code=200, headers=None):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    # ---------- contrôle d'accès ----------
    PUBLIC_API = {"/api/alive", "/api/public/summary", "/api/i18n/ar", "/api/device/ping"}
    OWNER_ONLY = {"/api/notify/detect", "/api/notify/test", "/api/notify/disconnect",
                  "/api/ai/key", "/api/ai/provider"}

    def _deny(self, path, method):
        """Renvoie True (et répond) si la requête doit être refusée faute de compte ouvert."""
        self.user = None
        db.set_uid(None)               # par défaut : parcelle du propriétaire (pages publiques)
        if path.startswith("/api/auth/") or path in self.PUBLIC_API or (path == "/api/readings" and method == "POST"):
            return False
        protected = path.startswith(("/api/", "/app/", "/photos/")) or path == "/app"
        if not protected:
            return False
        self.user = auth.user_from_cookie(self.headers.get("Cookie"))
        if self.user and self.user["status"] == "active":
            db.set_uid(self.user["id"])  # chaque compte ne voit et ne modifie que sa propre parcelle
            if (path in self.OWNER_ONLY or path.startswith("/api/users")) and self.user["role"] != "owner":
                self._json({"error": "réservé au propriétaire du compte"}, 403)
                return True
            return False
        if path.startswith("/api/"):
            self._json({"error": "connexion requise", "status": self.user["status"] if self.user else None}, 401)
        else:
            self._redirect("/login?next=" + quote(path))
        return True

    def _session_reply(self, user, code=200):
        token = auth.new_session(user["id"])
        return self._json({"user": auth.public_user(db.user_by_id(user["id"]))}, code,
                          {"Set-Cookie": auth.cookie_header(token)})

    def _auth_post(self, path, body):
        ip = self.client_address[0]
        if path == "/api/auth/logout":
            auth.end_session(self.headers.get("Cookie"))
            return self._json({"ok": True}, 200, {"Set-Cookie": auth.cookie_header("", 0)})
        if auth.too_many(ip):
            return self._json({"error": "Trop d'essais. Réessayez dans 10 minutes."}, 429)
        if path == "/api/auth/register":
            name = (body.get("name") or "").strip()[:60]
            email = (body.get("email") or "").strip().lower()
            pw = body.get("password") or ""
            if not name or not auth.EMAIL_RE.match(email):
                return self._json({"error": "Nom ou adresse e-mail invalide."}, 400)
            problem = auth.password_problem(pw)
            if problem:
                return self._json({"error": problem}, 400)
            if db.user_by_email(email):
                return self._json({"error": "Un compte existe déjà avec cette adresse. Connectez-vous."}, 409)
            uid = db.create_user(email, name, password_hash=auth.hash_password(pw))
            return self._session_reply({"id": uid}, 201)
        if path == "/api/auth/login":
            email = (body.get("email") or "").strip().lower()
            u = db.user_by_email(email) if email else None
            if not u or not u.get("password_hash") or not auth.check_password(body.get("password") or "", u["password_hash"]):
                auth.record_fail(ip)
                return self._json({"error": "Adresse e-mail ou mot de passe incorrect."}, 401)
            auth.clear_fails(ip)
            return self._session_reply(u)
        if path == "/api/auth/google":
            try:
                email, name, sub, picture = auth.verify_google(body.get("credential") or "")
            except ValueError as e:
                auth.record_fail(ip)
                return self._json({"error": str(e)}, 401)
            u = db.user_by_email(email)
            if u:
                if u.get("google_sub") and u["google_sub"] != sub:
                    return self._json({"error": "Ce compte Google ne correspond pas."}, 401)
                db.update_user(u["id"], google_sub=sub, picture=picture or u.get("picture"))
            else:
                u = {"id": db.create_user(email, name, google_sub=sub, picture=picture)}
            auth.clear_fails(ip)
            return self._session_reply(u)
        return self._json({"error": "route inconnue"}, 404)

    def _body(self, limit=1_000_000):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("Requête trop volumineuse")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def _static(self, path):
        """/ → site de présentation · /app/ → tableau de bord · /photos/ → photos envoyées."""
        if path == "/app":
            self.send_response(301)
            self.send_header("Location", "/app/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path in ("/login", "/login/"):
            base, rel = AUTH_DIR, "login.html"
        elif path.startswith("/auth/"):
            base, rel = AUTH_DIR, path[len("/auth/"):]
        elif path.startswith("/photos/"):
            base, rel = os.path.abspath(db.PHOTOS_DIR), path[len("/photos/"):]
            if db.photo_file_owner(rel) != db.uid():
                return self._json({"error": "introuvable"}, 404)
        elif path.startswith("/app/"):
            base, rel = DASHBOARD_DIR, (path[len("/app/"):] or "index.html")
        else:
            base, rel = SITE_DIR, ("index.html" if path in ("", "/") else path.lstrip("/"))
        full = os.path.abspath(os.path.join(base, rel))
        if not full.startswith(base + os.sep) or not os.path.isfile(full):
            return self._json({"error": "introuvable"}, 404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if os.environ.get("SMARTFARM_VERBOSE"):
            super().log_message(fmt, *args)

    # ---------- routes ----------
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if self._deny(u.path, "GET"):
                return
            if u.path == "/api/alive":     # le site vitrine (Vercel) vérifie que le serveur du PC répond
                return self._json({"ok": True}, headers={"Access-Control-Allow-Origin": "*"})
            if u.path == "/api/auth/config":
                return self._json({"google_client_id": auth.google_client_id(), "has_users": db.count_users() > 0,
                                   "google_origins": auth.google_origins(), "google_relay": auth.google_relay()},
                                  headers={"Access-Control-Allow-Origin": "*"})   # lu aussi par la page google.html
            if u.path == "/api/auth/me":
                return self._json({"user": auth.public_user(auth.user_from_cookie(self.headers.get("Cookie")))})
            if u.path == "/api/public/summary":
                r = db.latest_reading() or {}
                return self._json({"soil_moisture": r.get("soil_moisture"), "air_temp": r.get("air_temp"), "ts": r.get("ts"),
                                   "pump_on": irrigation.pump_state()["on"], "decision": irrigation.last_decision()["reason"]})
            if u.path == "/api/users":
                return self._json({"users": db.list_users(), "me": self.user["id"]})
            if u.path == "/api/status":
                return self._json(build_status())
            if u.path == "/api/readings":
                hours = min(float(q.get("hours", ["24"])[0]), 24 * 30)
                return self._json(db.readings_since(hours * 3600))
            if u.path == "/api/irrigation/events":
                return self._json(db.list_events(int(q.get("limit", ["50"])[0])))
            if u.path == "/api/alerts":
                return self._json(db.list_alerts(int(q.get("limit", ["50"])[0])))
            if u.path == "/api/disease":
                return self._json(disease_status(force=True))
            if u.path == "/api/weather":
                return self._json(get_weather(db.get_settings()))
            if u.path == "/api/settings":
                return self._json(public_settings(db.get_settings()))
            if u.path == "/api/knowledge":
                kb = knowledge.KB
                return self._json({
                    "crops": {k: v["label"] for k, v in kb["crops"].items()},
                    "soil_types": {k: v["label"] for k, v in kb["soil_types"].items()},
                    "nutrients": {k: {"low": v["low"], "high": v["high"], "unit": v["unit"]}
                                  for k, v in kb["nutrients"].items()},
                })
            if u.path == "/api/chat/history":
                conv = q.get("conv", [None])[0]
                return self._json(db.chat_history(200, int(conv) if conv else None))
            if u.path == "/api/chat/conversations":
                return self._json({"current": db.current_conv(), "conversations": db.list_conversations()})
            if u.path == "/api/stats":
                days = max(1, min(int(q.get("days", ["7"])[0]), 90))
                data = db.stats(days)
                st = db.get_settings()
                data["pump_flow_lpm"] = st["pump_flow_lpm"]
                data["costs"] = costs(sum(w["seconds"] for w in data["water"]), st)
                return self._json(data)
            if u.path == "/api/report":
                def day_ts(s, default):
                    try:
                        return time.mktime(time.strptime(s, "%Y-%m-%d"))
                    except (TypeError, ValueError):
                        return default
                t1 = day_ts(q.get("to", [None])[0], time.time() - 86400) + 86400
                t0 = day_ts(q.get("from", [None])[0], t1 - 30 * 86400)
                if t1 - t0 > 400 * 86400 or t1 <= t0:
                    return self._json({"error": "période invalide"}, 400)
                return self._json(build_report(t0, t1))
            if u.path == "/api/photos":
                return self._json(db.list_photos())
            if u.path == "/api/device/ping":
                ok = db.uid_for_device_key(self.headers.get("X-Device-Key")) is not None
                return self._json({"ok": ok, "server_time": time.time()}, 200 if ok else 401)
            if u.path == "/api/device":
                return self._json(device_info())
            if u.path == "/api/i18n/ar":
                with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_ar.json"), encoding="utf-8") as f:
                    return self._json(json.load(f))
            if u.path.startswith("/api/"):
                return self._json({"error": "route inconnue"}, 404)
            return self._static(u.path)
        except Exception as e:
            return self._json({"error": str(e)}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        try:
            if self._deny(u.path, "POST"):
                return
            body = self._body(limit=15_000_000 if u.path == "/api/photos" else 1_000_000)
            if u.path.startswith("/api/auth/"):
                return self._auth_post(u.path, body)
            if u.path.startswith("/api/users/"):
                parts = u.path.split("/")
                uid, action = int(parts[3]), parts[4] if len(parts) > 4 else ""
                if uid == self.user["id"]:
                    return self._json({"error": "Vous ne pouvez pas modifier votre propre compte ici."}, 400)
                if action == "approve":
                    db.update_user(uid, status="active")
                elif action == "suspend":
                    db.update_user(uid, status="pending")
                elif action == "delete":
                    db.delete_user(uid)
                else:
                    return self._json({"error": "action inconnue"}, 400)
                return self._json({"users": db.list_users(), "me": self.user["id"]})
            if u.path == "/api/photos":
                return self._post_photo(body)
            if u.path == "/api/device/key":
                db.update_settings({"device_key": secrets.token_urlsafe(12)})
                return self._json(device_info())
            if u.path == "/api/notify/detect":
                token = (body.get("token") or "").strip() or db.get_settings().get("telegram_token")
                if not token or not re.match(r"^\d{5,12}:[A-Za-z0-9_-]{30,}$", token):
                    return self._json({"error": "Jeton du bot invalide (il ressemble à 123456789:AA…)."}, 400)
                try:
                    name = notifier.bot_name(token)
                    chats = notifier.detect_chats(token)
                except Exception:
                    return self._json({"error": "Telegram ne reconnaît pas ce jeton, ou pas d'accès Internet."}, 400)
                known = {c["id"]: c for c in db.get_settings().get("telegram_chats") or []}
                known.update({c["id"]: c for c in chats})
                db.update_settings({"telegram_token": token, "telegram_chats": list(known.values())})
                return self._json({"bot": name, "chats": list(known.values())})
            if u.path == "/api/ai/key":
                prov = "claude" if body.get("provider") == "claude" else "groq"
                key = str(body.get("key") or "").strip()
                if not key:   # retirer la clé du fournisseur
                    db.update_settings({"groq_api_key": ""} if prov == "groq" else {"anthropic_api_key": ""})
                    return self._json(public_settings(db.get_settings()))
                if prov == "groq":
                    if not key.startswith("gsk_"):
                        return self._json({"error": "Cette clé ne ressemble pas à une clé Groq (elle commence par gsk_)."}, 400)
                    try:
                        chat_m, vision_m = llm.pick_models(llm.groq_models(key))
                    except llm.AIError as e:
                        return self._json({"error": str(e)}, 400)
                    if not chat_m:
                        return self._json({"error": "Aucun modèle de conversation disponible sur ce compte Groq."}, 400)
                    db.update_settings({"ai_provider": "groq", "groq_api_key": key, "groq_chat_model": chat_m,
                                        "groq_vision_model": vision_m or ""})
                else:
                    if not key.startswith("sk-ant-"):
                        return self._json({"error": "Cette clé ne ressemble pas à une clé Claude (elle commence par sk-ant-)."}, 400)
                    db.update_settings({"ai_provider": "claude", "anthropic_api_key": key})
                return self._json(public_settings(db.get_settings()))
            if u.path == "/api/ai/provider":
                db.update_settings({"ai_provider": "claude" if body.get("provider") == "claude" else "groq"})
                return self._json(public_settings(db.get_settings()))
            if u.path == "/api/notify/test":
                if not notifier.configured():
                    return self._json({"error": "Aucun téléphone relié : écrivez /start au bot puis « Détecter »."}, 400)
                notifier.test()
                return self._json({"ok": True})
            if u.path == "/api/notify/disconnect":
                db.update_settings({"telegram_token": "", "telegram_chats": []})
                return self._json({"ok": True})
            if u.path == "/api/data/reset":
                if body.get("confirm") != "EFFACER":
                    return self._json({"error": "confirmation manquante"}, 400)
                irrigation.manual("off")
                path = db.reset_measurements()
                disease_status(force=True)
                return self._json({"ok": True, "backup": os.path.relpath(path, os.path.join(db.DATA_DIR, ".."))})
            if u.path.startswith("/api/photos/") and u.path.endswith("/analyze"):
                pid = int(u.path.split("/")[3])
                if not db.get_photo(pid):
                    return self._json({"error": "photo introuvable"}, 404)
                if not vision.available():
                    return self._json({"error": "Ajoutez la clé Claude dans Réglages › IA pour le diagnostic par IA."}, 400)
                start_photo_analysis(pid)
                return self._json({"ok": True})
            if u.path.startswith("/api/photos/") and u.path.endswith("/delete"):
                f = db.delete_photo(int(u.path.split("/")[3]))
                if f:
                    try:
                        os.remove(os.path.join(db.PHOTOS_DIR, f))
                    except OSError:
                        pass
                return self._json({"ok": True})
            if u.path == "/api/readings":
                return self._post_reading(body)
            if u.path == "/api/pump":
                action = body.get("action")
                if action not in ("on", "off"):
                    return self._json({"error": "action doit être 'on' ou 'off'"}, 400)
                return self._json(irrigation.manual(action, body.get("duration_s")))
            if u.path.startswith("/api/alerts/") and u.path.endswith("/ack"):
                db.ack_alert(int(u.path.split("/")[3]))
                return self._json({"ok": True})
            if u.path == "/api/chat":
                msg = (body.get("message") or "").strip()
                if not msg:
                    return self._json({"error": "message vide"}, 400)
                return self._json(chatbot.answer(msg[:2000], chat_context()))
            if u.path == "/api/chat/clear":
                return self._json({"ok": True, "conv": db.new_conversation()})
            if u.path == "/api/chat/open":
                db.open_conversation(int(body.get("conv") or 1))
                return self._json({"ok": True})
            if u.path == "/api/chat/delete":
                conv = int(body.get("conv") or 0)
                db.delete_conversation(conv)
                if conv == db.current_conv():
                    db.new_conversation()
                return self._json({"ok": True})
            return self._json({"error": "route inconnue"}, 404)
        except json.JSONDecodeError:
            return self._json({"error": "JSON invalide"}, 400)
        except Exception as e:
            return self._json({"error": str(e)}, 500)

    def do_PUT(self):
        u = urlparse(self.path)
        try:
            if self._deny(u.path, "PUT"):
                return
            if u.path != "/api/settings":
                return self._json({"error": "route inconnue"}, 404)
            body = self._body()
            if "google_client_id" in body:
                if self.user["role"] != "owner":
                    return self._json({"error": "réservé au propriétaire du compte"}, 403)
                body["google_client_id"] = str(body["google_client_id"] or "").strip()[:200]
            if "anthropic_api_key" in body:
                key = str(body["anthropic_api_key"] or "").strip()
                if self.user["role"] != "owner":
                    return self._json({"error": "réservé au propriétaire du compte"}, 403)
                if key == "********":
                    body.pop("anthropic_api_key")
                elif key and not key.startswith("sk-ant-"):
                    return self._json({"error": "Cette clé ne ressemble pas à une clé Claude (elle commence par sk-ant-)."}, 400)
                else:
                    body["anthropic_api_key"] = key[:300]
            kb = knowledge.KB
            if "crop" in body and body["crop"] not in kb["crops"]:
                return self._json({"error": "culture inconnue"}, 400)
            if "soil_type" in body and body["soil_type"] not in kb["soil_types"]:
                return self._json({"error": "type de sol inconnu"}, 400)
            if "mode" in body and body["mode"] not in ("auto", "manuel"):
                return self._json({"error": "mode doit être 'auto' ou 'manuel'"}, 400)
            if body.get("device_key") in ("", "********"):
                body.pop("device_key")
            clean_schedule_settings(body)
            numeric = ["latitude", "longitude", "sec_per_percent", "max_duration_s",
                       "min_interval_min", "rain_mm_skip", "rain_prob_skip", "pump_flow_lpm"]
            for k in numeric:
                if k in body:
                    body[k] = float(body[k])
            if "threshold_override" in body:
                v = body["threshold_override"]
                body["threshold_override"] = None if v in (None, "") else float(v)
            s = db.update_settings(body)
            disease_status(force=True)
            return self._json(public_settings(s))
        except (ValueError, json.JSONDecodeError) as e:
            return self._json({"error": f"valeur invalide : {e}"}, 400)

    def _post_photo(self, body):
        """Photo envoyée par le tableau de bord en data-URL (déjà redimensionnée côté navigateur)."""
        data = body.get("data") or ""
        kinds = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        try:
            header, b64 = data.split(",", 1)
            mime = header[5:].split(";")[0]
            ext = kinds[mime]
            raw = base64.b64decode(b64, validate=True)
        except (ValueError, KeyError, binascii.Error):
            return self._json({"error": "image invalide (JPEG, PNG ou WebP attendu)"}, 400)
        os.makedirs(db.PHOTOS_DIR, exist_ok=True)
        name = f"{int(time.time() * 1000)}_{secrets.token_hex(4)}.{ext}"
        with open(os.path.join(db.PHOTOS_DIR, name), "wb") as f:
            f.write(raw)
        kind = body.get("kind") if body.get("kind") in ("parcelle", "feuilles", "fruits", "sol", "materiel") else "parcelle"
        colors = None
        if isinstance(body.get("colors"), dict):   # analyse des couleurs faite dans le navigateur
            colors = {k: round(max(0.0, min(100.0, float(v))), 1) for k, v in body["colors"].items()
                      if k in ("green", "yellow", "brown", "white", "dark", "plant") and isinstance(v, (int, float))}
        pid = db.add_photo(name, (body.get("caption") or "").strip()[:300], kind, colors)
        if kind in ("feuilles", "fruits", "parcelle") and vision.available():
            start_photo_analysis(pid)
        return self._json({"id": pid, "file": name, "ai": vision.available()})

    def _post_reading(self, body):
        owner = db.uid_for_device_key(self.headers.get("X-Device-Key"))
        if owner is None:
            return self._json({"error": "clé du boîtier invalide"}, 401)
        db.set_uid(owner)              # les mesures vont sur la parcelle du compte de cette clé
        code, resp = ingest_reading(body, self.client_address[0])
        return self._json(resp, code)


def ingest_reading(body, client_ip):
    """Traite une mesure de boîtier (WiFi ou pont USB) : enregistrement, arrosage, alertes."""
    settings = db.get_settings()
    device_id = str(body.get("device_id") or "inconnu")[:40]

    def as_int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None
    db.touch_device(device_id, ip=str(body.get("ip") or client_ip)[:45],
                    fw=str(body["fw"])[:20] if body.get("fw") else None,
                    rssi=as_int(body.get("rssi")), uptime_s=as_int(body.get("uptime_s")),
                    sensor=str(body["sensor"])[:20] if body.get("sensor") else None,
                    sensor_ok=body.get("sensor_ok"))
    reading = clean_reading(body)
    if not any(f in reading for f in ("soil_moisture", "soil_temp", "soil_ph", "soil_ec", "n", "p", "k")):
        return 400, {"error": "aucune mesure valide"}
    if device_id in db.DEMO_DEVICES:
        # simulateur : jamais affiché, ne commande jamais la pompe et ne crée pas d'alerte
        return 200, {"pump": False, "seconds_remaining": 0, "decision": "Simulateur ignoré : seul le vrai boîtier est pris en compte."}
    w = get_weather(settings)
    # boîtier sans capteur d'air : température / humidité de l'air prises de la météo réelle du lieu
    air_source = "capteur"
    cur = (w or {}).get("current") or {}
    if "air_temp" not in reading and cur.get("temperature_2m") is not None:
        reading["air_temp"] = round(float(cur["temperature_2m"]), 1)
        air_source = "meteo"
    if "air_humidity" not in reading and cur.get("relative_humidity_2m") is not None:
        reading["air_humidity"] = round(float(cur["relative_humidity_2m"]), 1)
        air_source = "meteo"
    if "air_temp" not in reading and "air_humidity" not in reading:
        air_source = None
    state = irrigation.process_reading(reading, w)
    db.insert_reading(device_id, reading, state["on"], air_source=air_source)
    disease_status()  # réévalue les risques (max 1 fois / min) et crée les alertes
    soil.analyze(reading, settings, create_alerts=True)
    return 200, {
        "pump": state["on"],
        "seconds_remaining": state["seconds_remaining"],
        "decision": irrigation.last_decision()["reason"],
    }


def main():
    settings = db.get_settings()
    print("=" * 60)
    print(" Système d'irrigation intelligent — IoT + IA")
    print(f" Site : http://localhost:{PORT}   ·   Tableau de bord : http://localhost:{PORT}/app/")
    print(f" Culture : {settings['crop']}  |  Sol : {settings['soil_type']}  |  Mode : {settings['mode']}")
    src = " (clé du fichier .env)" if "GROQ_API_KEY" in ENV_LOADED else ""
    print(f" IA : {('Groq' if llm.provider() == 'groq' else 'Claude') + ' active' + src if llm.available() else 'inactive : collez votre clé Groq dans le fichier .env (GROQ_API_KEY=…) puis relancez'}")
    urls = [f"http://{ip}:{PORT}" for ip in lan_addresses()]
    print(f" Adresse à saisir dans le boîtier ESP32 : {urls[0] if urls else '(aucun réseau détecté)'}")
    if settings["device_key"] == "change-me":
        print(" ⚠ Clé du boîtier par défaut : générez-en une dans Tableau de bord › Boîtier.")
    print("=" * 60)
    db.on_alert = notifier.alert
    irrigation.on_event = lambda *a: notifier.pump_event(*a) if db.uid() == db.owner_id() else None
    threading.Thread(target=background_loop, daemon=True).start()
    if os.environ.get("SAQIYA_USB", "1") != "0":
        usb_bridge.start(ingest_reading)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
