"""Stockage SQLite : mesures des capteurs, irrigations, alertes, réglages, chat.

Une parcelle par compte : chaque ligne de données porte le numéro du compte (uid).
Le compte « courant » est fixé par requête (set_uid / as_user) ; toutes les fonctions
ci-dessous lisent et écrivent uniquement les données de ce compte.
Les réglages du serveur (clés IA, Google, Telegram) restent communs ; les autres
réglages (culture, sol, mode, programmes, coûts, clé du boîtier…) sont propres à chaque compte.
"""
import contextlib
import json
import os
import secrets
import sqlite3
import threading
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
DB_PATH = os.environ.get("SMARTFARM_DB", os.path.join(DATA_DIR, "smartfarm.db"))

DEFAULT_SETTINGS = {
    "crop": "tomate",
    "soil_type": "limoneux",
    "mode": "auto",                 # auto | manuel
    "latitude": 36.47,              # Mitidja (Blida), Algérie
    "longitude": 2.83,
    "threshold_override": None,     # seuil d'humidité forcé (%) ou None = automatique
    "sec_per_percent": 30.0,        # secondes de pompe pour +1 % d'humidité (appris)
    "max_duration_s": 900,          # durée maximale d'un arrosage
    "min_interval_min": 60,         # temps minimal entre deux arrosages
    "rain_mm_skip": 3.0,            # pluie prévue (mm / 12 h) qui annule l'arrosage
    "rain_prob_skip": 70,           # probabilité de pluie (%) qui annule l'arrosage
    "device_key": "change-me",      # clé partagée avec le boîtier IoT (une par compte)
    "pump_flow_lpm": 10.0,          # débit de la pompe (litres / minute) pour estimer l'eau consommée
    "google_client_id": "",         # identifiant OAuth Google (connexion avec Gmail)
    "anthropic_api_key": "",        # clé Claude (option), saisie par le propriétaire
    "ai_provider": "groq",          # groq (par défaut) ou claude
    "groq_api_key": "",             # clé Groq (conseiller + diagnostic des photos)
    "groq_chat_model": "",          # choisi automatiquement à l'enregistrement de la clé
    "groq_vision_model": "",
    # alertes Telegram
    "telegram_token": "",
    "telegram_chats": [],           # [{"id": 123, "name": "Ahmed"}]
    "notify": {"alerts": True, "pump": True, "offline": True, "daily": True},
    "notify_lang": "fr",
    # programmation horaire
    "windows_enabled": False,
    "windows": [{"start": "05:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
    "schedules": [],                # [{"time": "06:30", "minutes": 10, "days": [0..6], "only_if_dry": True, "on": True}]
    # coûts
    "currency": "DA",               # dinar algérien
    "water_price_m3": 6.0,          # prix de l'eau (DA par m³), à ajuster selon la facture
    "pump_power_kw": 0.75,          # puissance de la pompe (kW)
    "electricity_price_kwh": 4.5,   # prix de l'électricité (DA par kWh), à ajuster
    # conseiller : numéro de la conversation en cours
    "chat_conv": 1,
}
# réglages du serveur, communs à tous les comptes
GLOBAL_KEYS = {"google_client_id", "anthropic_api_key", "ai_provider", "groq_api_key", "groq_chat_model",
               "groq_vision_model", "telegram_token", "telegram_chats", "notify", "notify_lang"}
PHOTOS_DIR = os.path.join(DATA_DIR, "photos")
DATA_TABLES = ("readings", "irrigation_events", "alerts", "chat", "photos", "devices")

READING_FIELDS = [
    "soil_moisture", "soil_temp", "soil_ph", "soil_ec", "n", "p", "k",
    "air_temp", "air_humidity", "rain_detected",
]

_lock = threading.RLock()
_conn = None


def _db():
    global _conn
    if _conn is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
    return _conn


# ---------- compte courant ----------
_ctx = threading.local()
_owner_cache = {"id": None, "ts": 0}


def owner_id():
    now = time.time()
    if _owner_cache["id"] is None or now - _owner_cache["ts"] > 30:
        with _lock:
            r = _db().execute("SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1").fetchone()
        _owner_cache.update(id=r[0] if r else None, ts=now)
    return _owner_cache["id"]


def set_uid(user_id):
    _ctx.uid = user_id


def uid():
    """Compte dont on lit / écrit la parcelle (par défaut : le propriétaire)."""
    u = getattr(_ctx, "uid", None)
    return u if u is not None else (owner_id() or 0)


@contextlib.contextmanager
def as_user(user_id):
    prev = getattr(_ctx, "uid", None)
    _ctx.uid = user_id
    try:
        yield
    finally:
        _ctx.uid = prev


def init():
    with _lock:
        c = _db()
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL NOT NULL, device_id TEXT,
                soil_moisture REAL, soil_temp REAL, soil_ph REAL, soil_ec REAL,
                n REAL, p REAL, k REAL,
                air_temp REAL, air_humidity REAL, rain_detected INTEGER,
                pump_on INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
            CREATE TABLE IF NOT EXISTS irrigation_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts_start REAL, ts_end REAL, mode TEXT, reason TEXT,
                planned_s REAL, duration_s REAL,
                moisture_before REAL, moisture_after REAL
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL, kind TEXT, level TEXT, title TEXT, message TEXT,
                ack INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS user_settings (uid INTEGER, key TEXT, value TEXT, PRIMARY KEY (uid, key));
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT, google_sub TEXT, picture TEXT,
                role TEXT DEFAULT 'member', status TEXT DEFAULT 'pending', created REAL, last_login REAL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id INTEGER, created REAL, expires REAL
            );
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY, first_seen REAL, last_seen REAL,
                ip TEXT, fw TEXT, rssi INTEGER, uptime_s INTEGER, readings INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL, file TEXT, caption TEXT, kind TEXT
            );
            CREATE TABLE IF NOT EXISTS chat (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL, role TEXT, content TEXT, source TEXT
            );
            """
        )
        # colonnes ajoutées au fil des versions (bases existantes)
        cols = [("photos", "analysis", "TEXT"), ("photos", "analysis_status", "TEXT"),
                ("photos", "colors", "TEXT"), ("readings", "air_source", "TEXT"),
                ("devices", "sensor", "TEXT"), ("devices", "sensor_ok", "INTEGER"), ("chat", "conv", "INTEGER")]
        cols += [(t, "uid", "INTEGER") for t in DATA_TABLES]
        for table, col, typ in cols:
            try:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass
        for t, col in (("readings", "uid, ts"), ("irrigation_events", "uid, ts_start"), ("alerts", "uid, ts"),
                       ("chat", "uid, conv"), ("photos", "uid, ts")):
            c.execute(f"CREATE INDEX IF NOT EXISTS idx_{t}_uid ON {t}({col})")
        for k, v in DEFAULT_SETTINGS.items():
            c.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (k, json.dumps(v)))
        c.commit()
    _adopt_orphans()


def _adopt_orphans():
    """Données d'avant « une parcelle par compte » : elles appartiennent au propriétaire."""
    oid = owner_id()
    if not oid:
        return
    with _lock:
        c = _db()
        for t in DATA_TABLES:
            c.execute(f"UPDATE {t} SET uid = ? WHERE uid IS NULL", (oid,))
        c.execute("UPDATE chat SET conv = 1 WHERE conv IS NULL")
        has = c.execute("SELECT COUNT(*) FROM user_settings WHERE uid = ?", (oid,)).fetchone()[0]
        if not has:   # anciens réglages communs -> réglages du propriétaire
            for r in c.execute("SELECT key, value FROM settings").fetchall():
                if r["key"] not in GLOBAL_KEYS and r["key"] in DEFAULT_SETTINGS:
                    c.execute("INSERT OR IGNORE INTO user_settings(uid, key, value) VALUES (?, ?, ?)", (oid, r["key"], r["value"]))
        # comptes créés avant « une parcelle par compte » : chacun reçoit sa propre clé de boîtier
        for (u,) in c.execute("SELECT id FROM users WHERE id NOT IN "
                              "(SELECT uid FROM user_settings WHERE key = 'device_key' AND value != ?)", (json.dumps("change-me"),)).fetchall():
            c.execute("INSERT OR REPLACE INTO user_settings(uid, key, value) VALUES (?, 'device_key', ?)",
                      (u, json.dumps(secrets.token_urlsafe(12))))
        c.commit()


def _rows(cur):
    return [dict(r) for r in cur.fetchall()]


# ---------- réglages ----------
def get_settings(user_id=None):
    u = uid() if user_id is None else user_id
    with _lock:
        g = _db().execute("SELECT key, value FROM settings").fetchall()
        mine = _db().execute("SELECT key, value FROM user_settings WHERE uid = ?", (u,)).fetchall()
    s = dict(DEFAULT_SETTINGS)
    s.update({r["key"]: json.loads(r["value"]) for r in g if r["key"] in GLOBAL_KEYS})
    s.update({r["key"]: json.loads(r["value"]) for r in mine if r["key"] in DEFAULT_SETTINGS and r["key"] not in GLOBAL_KEYS})
    return s


def update_settings(values, user_id=None):
    u = uid() if user_id is None else user_id
    with _lock:
        c = _db()
        for k, v in values.items():
            if k not in DEFAULT_SETTINGS:
                continue
            if k in GLOBAL_KEYS:
                c.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (k, json.dumps(v)))
            else:
                c.execute("INSERT OR REPLACE INTO user_settings(uid, key, value) VALUES (?, ?, ?)", (u, k, json.dumps(v)))
        c.commit()
    return get_settings(u)


def uid_for_device_key(key):
    """Compte auquel appartient une clé de boîtier (None si inconnue)."""
    if not key:
        return None
    with _lock:
        r = _db().execute("SELECT uid FROM user_settings WHERE key = 'device_key' AND value = ? ORDER BY uid LIMIT 1",
                          (json.dumps(key),)).fetchone()
    return r[0] if r else None


# ---------- mesures ----------
def insert_reading(device_id, data, pump_on, ts=None, air_source=None):
    ts = ts or time.time()
    vals = [data.get(f) for f in READING_FIELDS]
    with _lock:
        c = _db()
        cur = c.execute(
            f"INSERT INTO readings(ts, device_id, {', '.join(READING_FIELDS)}, pump_on, air_source, uid) "
            f"VALUES (?, ?, {', '.join('?' * len(READING_FIELDS))}, ?, ?, ?)",
            [ts, device_id, *vals, int(bool(pump_on)), air_source, uid()],
        )
        c.commit()
    _real_cache.pop(uid(), None)
    return cur.lastrowid


DEMO_DEVICES = ("esp32-simulateur", "historique-demo")
_real_cache = {}


def real_since():
    """Instant de la première vraie mesure de la parcelle du compte (None si son boîtier n'a encore rien envoyé).
    Tout ce qui précède (démonstration, simulateur) n'est jamais affiché."""
    u, now = uid(), time.time()
    hit = _real_cache.get(u)
    if not hit or now - hit[0] > 15:
        with _lock:
            row = _db().execute(
                f"SELECT MIN(ts) FROM readings WHERE uid = ? AND device_id NOT IN ({','.join('?' * len(DEMO_DEVICES))})",
                (u, *DEMO_DEVICES)).fetchone()
        hit = (now, row[0] if row and row[0] is not None else None)
        _real_cache[u] = hit
    return hit[1]


def real_device_active():
    return real_since() is not None


def floor_ts():
    """Borne basse des arrosages / alertes affichés : la première vraie mesure (sinon « jamais »)."""
    s = real_since()
    return s - 60 if s is not None else time.time() + 10 * 365 * 86400


def source_filter():
    """Clause SQL : seulement la parcelle du compte, jamais la démonstration ni le simulateur."""
    return f" AND uid = {int(uid())} AND device_id NOT IN (" + ",".join(f"'{d}'" for d in DEMO_DEVICES) + ")"


def latest_reading():
    with _lock:
        r = _db().execute(f"SELECT * FROM readings WHERE 1=1{source_filter()} ORDER BY ts DESC LIMIT 1").fetchone()
    return dict(r) if r else None


def latest_reading_for(device_id):
    with _lock:
        r = _db().execute("SELECT * FROM readings WHERE device_id = ? AND uid = ? ORDER BY ts DESC LIMIT 1",
                          (device_id, uid())).fetchone()
    return dict(r) if r else None


def readings_since(seconds, limit=20000):
    since = time.time() - seconds
    with _lock:
        cur = _db().execute(   # les plus récentes d'abord (pour ne jamais couper la fin), puis remises dans l'ordre
            f"SELECT * FROM (SELECT * FROM readings WHERE ts >= ?{source_filter()} ORDER BY ts DESC LIMIT ?) ORDER BY ts ASC",
            (since, limit))
        return _rows(cur)


# ---------- irrigations ----------
def start_event(mode, reason, planned_s, moisture_before):
    with _lock:
        c = _db()
        cur = c.execute(
            "INSERT INTO irrigation_events(ts_start, mode, reason, planned_s, moisture_before, uid) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), mode, reason, planned_s, moisture_before, uid()),
        )
        c.commit()
        return cur.lastrowid


def end_event(event_id, moisture_after):
    with _lock:
        c = _db()
        row = c.execute("SELECT ts_start FROM irrigation_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            return None
        now = time.time()
        c.execute(
            "UPDATE irrigation_events SET ts_end=?, duration_s=?, moisture_after=? WHERE id=?",
            (now, now - row["ts_start"], moisture_after, event_id),
        )
        c.commit()
        return dict(c.execute("SELECT * FROM irrigation_events WHERE id=?", (event_id,)).fetchone())


def close_interrupted_events():
    """Clôt les arrosages restés ouverts (serveur arrêté pendant que la pompe tournait)."""
    with _lock:
        c = _db()
        rows = c.execute("SELECT id, ts_start, uid FROM irrigation_events WHERE ts_end IS NULL").fetchall()
        for r in rows:
            last = c.execute(
                "SELECT ts, soil_moisture FROM readings WHERE ts >= ? AND pump_on = 1 AND uid IS ? ORDER BY ts DESC LIMIT 1",
                (r["ts_start"], r["uid"]),
            ).fetchone()
            end = last["ts"] if last else r["ts_start"]
            c.execute(
                "UPDATE irrigation_events SET ts_end=?, duration_s=?, moisture_after=?, "
                "reason = reason || ' (interrompu : redémarrage du serveur)' WHERE id=?",
                (end, end - r["ts_start"], last["soil_moisture"] if last else None, r["id"]),
            )
        c.commit()
        return len(rows)


def list_events(limit=50):
    with _lock:
        return _rows(_db().execute(
            "SELECT * FROM irrigation_events WHERE uid = ? AND ts_start >= ? ORDER BY ts_start DESC LIMIT ?",
            (uid(), floor_ts(), limit)))


def last_finished_event():
    with _lock:
        r = _db().execute(
            "SELECT * FROM irrigation_events WHERE uid = ? AND ts_end IS NOT NULL AND ts_start >= ? ORDER BY ts_end DESC LIMIT 1",
            (uid(), floor_ts())).fetchone()
    return dict(r) if r else None


def water_stats(seconds=86400):
    since = max(time.time() - seconds, floor_ts())
    with _lock:
        r = _db().execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS total_s "
            "FROM irrigation_events WHERE uid = ? AND ts_start >= ?", (uid(), since)
        ).fetchone()
    return dict(r)


def insert_event_raw(ts_start, ts_end, mode, reason, moisture_before, moisture_after):
    """Insère un arrosage déjà terminé (utilisé par le générateur d'historique)."""
    with _lock:
        c = _db()
        c.execute(
            "INSERT INTO irrigation_events(ts_start, ts_end, mode, reason, planned_s, duration_s, "
            "moisture_before, moisture_after, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ts_start, ts_end, mode, reason, ts_end - ts_start, ts_end - ts_start,
             moisture_before, moisture_after, uid()),
        )
        c.commit()


# ---------- comptes ----------
USER_FIELDS = "id, email, name, picture, role, status, created, last_login, (password_hash IS NOT NULL) AS has_password, (google_sub IS NOT NULL) AS has_google"


def count_users():
    with _lock:
        return _db().execute("SELECT COUNT(*) FROM users").fetchone()[0]


def user_by_email(email):
    with _lock:
        r = _db().execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    return dict(r) if r else None


def user_by_id(user_id):
    with _lock:
        r = _db().execute(f"SELECT {USER_FIELDS} FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(r) if r else None


def create_user(email, name, password_hash=None, google_sub=None, picture=None):
    """Le tout premier compte devient propriétaire ; tous les comptes sont ouverts dès leur création.
    Chaque compte reçoit sa propre parcelle, vide, et sa propre clé de boîtier."""
    with _lock:
        c = _db()
        first = c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        cur = c.execute(
            "INSERT INTO users(email, name, password_hash, google_sub, picture, role, status, created) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (email.lower(), name, password_hash, google_sub, picture,
             "owner" if first else "member", "active", time.time()),
        )
        new_id = cur.lastrowid
        c.commit()
    _owner_cache["id"] = None
    if first:
        _adopt_orphans()          # la parcelle existante revient au propriétaire
    if get_settings(new_id).get("device_key") in (None, "", "change-me"):
        update_settings({"device_key": secrets.token_urlsafe(12)}, new_id)
    return new_id


def update_user(user_id, **fields):
    allowed = {"name", "password_hash", "google_sub", "picture", "status", "role", "last_login"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    with _lock:
        c = _db()
        c.execute(f"UPDATE users SET {', '.join(k + ' = ?' for k in sets)} WHERE id = ?", (*sets.values(), user_id))
        c.commit()


def list_users():
    with _lock:
        return _rows(_db().execute(f"SELECT {USER_FIELDS} FROM users ORDER BY status DESC, created ASC"))


def active_user_ids():
    with _lock:
        return [r[0] for r in _db().execute("SELECT id FROM users WHERE status = 'active'").fetchall()]


def delete_user(user_id):
    """Supprime un compte (jamais le propriétaire) et toute sa parcelle."""
    with _lock:
        c = _db()
        row = c.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None or row["role"] == "owner":
            return
        files = [r["file"] for r in c.execute("SELECT file FROM photos WHERE uid = ?", (user_id,)).fetchall()]
        c.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        for t in DATA_TABLES:
            c.execute(f"DELETE FROM {t} WHERE uid = ?", (user_id,))
        c.execute("DELETE FROM user_settings WHERE uid = ?", (user_id,))
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        c.commit()
    for f in files:
        try:
            os.remove(os.path.join(PHOTOS_DIR, f))
        except OSError:
            pass


def add_session(token_hash, user_id, days=30):
    now = time.time()
    with _lock:
        c = _db()
        c.execute("DELETE FROM sessions WHERE expires < ?", (now,))
        c.execute("INSERT INTO sessions(token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)",
                  (token_hash, user_id, now, now + days * 86400))
        c.commit()


def session_user(token_hash):
    with _lock:
        r = _db().execute("SELECT user_id FROM sessions WHERE token_hash = ? AND expires > ?",
                          (token_hash, time.time())).fetchone()
    return user_by_id(r["user_id"]) if r else None


def delete_session(token_hash):
    with _lock:
        c = _db()
        c.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        c.commit()


# ---------- boîtiers ----------
def touch_device(device_id, ip=None, fw=None, rssi=None, uptime_s=None, count=True, sensor=None, sensor_ok=None):
    now = time.time()
    ok = None if sensor_ok is None else int(bool(sensor_ok))
    with _lock:
        c = _db()
        c.execute(
            "INSERT INTO devices(id, first_seen, last_seen, ip, fw, rssi, uptime_s, readings, sensor, sensor_ok, uid) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, uid=excluded.uid, "
            "ip=COALESCE(excluded.ip, ip), fw=COALESCE(excluded.fw, fw), "
            "rssi=COALESCE(excluded.rssi, rssi), uptime_s=COALESCE(excluded.uptime_s, uptime_s), "
            "sensor=COALESCE(excluded.sensor, sensor), sensor_ok=COALESCE(excluded.sensor_ok, sensor_ok), "
            "readings=readings + ?",
            (device_id, now, now, ip, fw, rssi, uptime_s, int(count), sensor, ok, uid(), int(count)),
        )
        c.commit()


def list_devices(all_users=False):
    with _lock:
        if all_users:
            return _rows(_db().execute("SELECT * FROM devices ORDER BY last_seen DESC"))
        return _rows(_db().execute("SELECT * FROM devices WHERE uid = ? ORDER BY last_seen DESC", (uid(),)))


def reset_measurements():
    """Sauvegarde la base puis efface mesures, arrosages, alertes et boîtiers de la parcelle du compte."""
    backup_dir = os.path.join(DATA_DIR, "sauvegardes")
    os.makedirs(backup_dir, exist_ok=True)
    path = os.path.join(backup_dir, time.strftime("smartfarm-%Y%m%d-%H%M%S.db"))
    with _lock:
        c = _db()
        dst = sqlite3.connect(path)
        c.backup(dst)
        dst.close()
        for t in ("readings", "irrigation_events", "alerts", "devices"):
            c.execute(f"DELETE FROM {t} WHERE uid = ?", (uid(),))
        c.commit()
    _real_cache.pop(uid(), None)
    return path


# ---------- statistiques ----------
def stats(days=7):
    since = max(time.time() - days * 86400, floor_ts())
    day = "date(ts, 'unixepoch', 'localtime')"
    src = source_filter()
    u = uid()
    with _lock:
        c = _db()
        water = _rows(c.execute(
            "SELECT date(ts_start, 'unixepoch', 'localtime') AS day, COUNT(*) AS count, "
            "COALESCE(SUM(duration_s), 0) AS seconds FROM irrigation_events "
            "WHERE uid = ? AND ts_start >= ? GROUP BY day ORDER BY day", (u, since)))
        moisture = _rows(c.execute(
            f"SELECT {day} AS day, MIN(soil_moisture) AS min, MAX(soil_moisture) AS max, "
            f"AVG(soil_moisture) AS avg FROM readings WHERE ts >= ?{src} AND soil_moisture IS NOT NULL "
            f"GROUP BY day ORDER BY day", (since,)))
        climate = _rows(c.execute(
            f"SELECT {day} AS day, CAST(strftime('%H', ts, 'unixepoch', 'localtime') AS INTEGER) AS hour, "
            f"AVG(air_humidity) AS rh, AVG(air_temp) AS temp FROM readings "
            f"WHERE ts >= ?{src} AND air_humidity IS NOT NULL GROUP BY day, hour ORDER BY day, hour", (since,)))
        npk = _rows(c.execute(
            f"SELECT {day} AS day, AVG(n) AS n, AVG(p) AS p, AVG(k) AS k, AVG(soil_ph) AS ph, "
            f"AVG(soil_ec) AS ec FROM readings WHERE ts >= ?{src} GROUP BY day ORDER BY day", (since,)))
        temp = _rows(c.execute(
            f"SELECT {day} AS day, MIN(air_temp) AS min, MAX(air_temp) AS max FROM readings "
            f"WHERE ts >= ?{src} AND air_temp IS NOT NULL GROUP BY day ORDER BY day", (since,)))
    return {"water": water, "moisture": moisture, "climate": climate, "npk": npk, "temp": temp}


def report(t0, t1):
    """Données d'un rapport entre deux instants (secondes)."""
    t0 = max(t0, floor_ts())
    t1 = max(t1, t0)
    day = "date(ts, 'unixepoch', 'localtime')"
    src = source_filter()
    u = uid()
    with _lock:
        c = _db()
        days = _rows(c.execute(
            f"SELECT {day} AS day, AVG(soil_moisture) AS m_avg, MIN(soil_moisture) AS m_min, MAX(soil_moisture) AS m_max, "
            f"MIN(air_temp) AS t_min, MAX(air_temp) AS t_max, AVG(air_humidity) AS rh, MAX(rain_detected) AS rain "
            f"FROM readings WHERE ts >= ? AND ts < ?{src} GROUP BY day ORDER BY day", (t0, t1)))
        water = {r["day"]: r for r in _rows(c.execute(
            "SELECT date(ts_start, 'unixepoch', 'localtime') AS day, COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS s "
            "FROM irrigation_events WHERE uid = ? AND ts_start >= ? AND ts_start < ? GROUP BY day", (u, t0, t1)))}
        modes = _rows(c.execute(
            "SELECT mode, COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS s FROM irrigation_events "
            "WHERE uid = ? AND ts_start >= ? AND ts_start < ? GROUP BY mode", (u, t0, t1)))
        alerts = _rows(c.execute(
            "SELECT ts, kind, level, title FROM alerts WHERE uid = ? AND ts >= ? AND ts < ? ORDER BY ts DESC LIMIT 60", (u, t0, t1)))
        npk = c.execute("SELECT AVG(n) AS n, AVG(p) AS p, AVG(k) AS k, AVG(soil_ph) AS ph, AVG(soil_ec) AS ec "
                        f"FROM readings WHERE ts >= ? AND ts < ?{src}", (t0, t1)).fetchone()
    for d in days:
        w = water.get(d["day"], {})
        d["n"], d["s"] = w.get("n", 0), w.get("s", 0)
    for day_, w in water.items():   # jours avec arrosage mais sans mesure
        if not any(d["day"] == day_ for d in days):
            days.append({"day": day_, "n": w["n"], "s": w["s"]})
    days.sort(key=lambda d: d["day"])
    return {"days": days, "modes": modes, "alerts": alerts, "soil": dict(npk) if npk else {}}


# ---------- photos ----------
def add_photo(file, caption, kind, colors=None):
    with _lock:
        c = _db()
        cur = c.execute("INSERT INTO photos(ts, file, caption, kind, colors, analysis_status, uid) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (time.time(), file, caption, kind, json.dumps(colors) if colors else None, "none", uid()))
        c.commit()
        return cur.lastrowid


def _photo_row(r):
    d = dict(r)
    for k in ("analysis", "colors"):
        try:
            d[k] = json.loads(d[k]) if d.get(k) else None
        except ValueError:
            d[k] = None
    return d


def list_photos():
    with _lock:
        return [_photo_row(r) for r in _db().execute("SELECT * FROM photos WHERE uid = ? ORDER BY ts DESC", (uid(),)).fetchall()]


def get_photo(photo_id):
    with _lock:
        r = _db().execute("SELECT * FROM photos WHERE id = ? AND uid = ?", (photo_id, uid())).fetchone()
    return _photo_row(r) if r else None


def photo_file_owner(file):
    """Compte propriétaire d'un fichier photo (contrôle d'accès)."""
    with _lock:
        r = _db().execute("SELECT uid FROM photos WHERE file = ?", (file,)).fetchone()
    return r[0] if r else None


def set_photo_analysis(photo_id, status, analysis=None):
    with _lock:
        c = _db()
        c.execute("UPDATE photos SET analysis_status = ?, analysis = ? WHERE id = ?",
                  (status, json.dumps(analysis, ensure_ascii=False) if analysis is not None else None, photo_id))
        c.commit()


def delete_photo(photo_id):
    with _lock:
        c = _db()
        row = c.execute("SELECT file FROM photos WHERE id=? AND uid=?", (photo_id, uid())).fetchone()
        c.execute("DELETE FROM photos WHERE id=? AND uid=?", (photo_id, uid()))
        c.commit()
    return row["file"] if row else None


# ---------- alertes ----------
def add_alert(kind, level, title, message, dedupe_seconds=6 * 3600):
    """Ajoute une alerte sauf si une alerte identique non acquittée existe déjà récemment."""
    u = uid()
    with _lock:
        c = _db()
        dup = c.execute(
            "SELECT id FROM alerts WHERE uid=? AND kind=? AND title=? AND ack=0 AND ts >= ?",
            (u, kind, title, time.time() - dedupe_seconds),
        ).fetchone()
        if dup:
            return None
        cur = c.execute(
            "INSERT INTO alerts(ts, kind, level, title, message, uid) VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), kind, level, title, message, u),
        )
        c.commit()
        alert_id = cur.lastrowid
    if on_alert and u == owner_id():   # Telegram : réglé pour la parcelle du propriétaire
        try:
            on_alert(kind, level, title, message)
        except Exception as e:  # une notification ratée ne doit jamais bloquer l'enregistrement
            print(f"[alertes] {e!r}")
    return alert_id


on_alert = None   # rappel installé par le serveur (notifications Telegram)


def list_alerts(limit=50, only_open=False):
    q = "SELECT * FROM alerts WHERE uid = ? AND ts >= ? " + ("AND ack=0 " if only_open else "") + "ORDER BY ts DESC LIMIT ?"
    with _lock:
        return _rows(_db().execute(q, (uid(), floor_ts(), limit)))


def ack_alert(alert_id):
    with _lock:
        c = _db()
        c.execute("UPDATE alerts SET ack=1 WHERE id=? AND uid=?", (alert_id, uid()))
        c.commit()


# ---------- chat (conversations numérotées, gardées en historique) ----------
def current_conv():
    return int(get_settings().get("chat_conv") or 1)


def add_chat(role, content, source=None):
    with _lock:
        c = _db()
        c.execute("INSERT INTO chat(ts, role, content, source, uid, conv) VALUES (?, ?, ?, ?, ?, ?)",
                  (time.time(), role, content, source, uid(), current_conv()))
        c.commit()


def chat_history(limit=20, conv=None):
    conv = current_conv() if conv is None else conv
    with _lock:
        rows = _rows(_db().execute("SELECT * FROM chat WHERE uid = ? AND conv = ? ORDER BY id DESC LIMIT ?",
                                   (uid(), conv, limit)))
    return list(reversed(rows))


def new_conversation():
    """Garde la conversation en cours dans l'historique et en ouvre une nouvelle, vide."""
    with _lock:
        r = _db().execute("SELECT MAX(conv) FROM chat WHERE uid = ?", (uid(),)).fetchone()
    nxt = max(int(r[0] or 0), current_conv()) + 1
    update_settings({"chat_conv": nxt})
    return nxt


def open_conversation(conv):
    update_settings({"chat_conv": int(conv)})


def list_conversations(limit=50):
    with _lock:
        rows = _rows(_db().execute(
            "SELECT conv, MIN(ts) AS started, MAX(ts) AS last, COUNT(*) AS messages, "
            "(SELECT content FROM chat c2 WHERE c2.uid = chat.uid AND c2.conv = chat.conv AND c2.role = 'user' ORDER BY id LIMIT 1) AS title "
            "FROM chat WHERE uid = ? GROUP BY conv ORDER BY last DESC LIMIT ?", (uid(), limit)))
    cur = current_conv()
    for r in rows:
        r["current"] = r["conv"] == cur
    return rows


def delete_conversation(conv):
    with _lock:
        c = _db()
        c.execute("DELETE FROM chat WHERE uid = ? AND conv = ?", (uid(), int(conv)))
        c.commit()


def clear_chat():
    """Nouvelle conversation (l'ancienne reste dans l'historique)."""
    return new_conversation()
