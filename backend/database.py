"""Stockage SQLite : mesures des capteurs, irrigations, alertes, réglages, chat."""
import json
import os
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
    "device_key": "change-me",      # clé partagée avec le boîtier IoT
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
}
PHOTOS_DIR = os.path.join(DATA_DIR, "photos")

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
        for table, col, typ in (("photos", "analysis", "TEXT"), ("photos", "analysis_status", "TEXT"),
                                ("photos", "colors", "TEXT"), ("readings", "air_source", "TEXT"),
                                ("devices", "sensor", "TEXT"), ("devices", "sensor_ok", "INTEGER")):
            try:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass
        for k, v in DEFAULT_SETTINGS.items():
            c.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (k, json.dumps(v)))
        c.commit()


def _rows(cur):
    return [dict(r) for r in cur.fetchall()]


# ---------- réglages ----------
def get_settings():
    with _lock:
        rows = _db().execute("SELECT key, value FROM settings").fetchall()
    s = dict(DEFAULT_SETTINGS)
    s.update({r["key"]: json.loads(r["value"]) for r in rows})
    return s


def update_settings(values):
    with _lock:
        c = _db()
        for k, v in values.items():
            if k in DEFAULT_SETTINGS:
                c.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (k, json.dumps(v)))
        c.commit()
    return get_settings()


# ---------- mesures ----------
def insert_reading(device_id, data, pump_on, ts=None, air_source=None):
    ts = ts or time.time()
    vals = [data.get(f) for f in READING_FIELDS]
    with _lock:
        c = _db()
        cur = c.execute(
            f"INSERT INTO readings(ts, device_id, {', '.join(READING_FIELDS)}, pump_on, air_source) "
            f"VALUES (?, ?, {', '.join('?' * len(READING_FIELDS))}, ?, ?)",
            [ts, device_id, *vals, int(bool(pump_on)), air_source],
        )
        c.commit()
        return cur.lastrowid


DEMO_DEVICES = ("esp32-simulateur", "historique-demo")
_real_cache = {"ts": 0, "since": None}


def real_since():
    """Instant de la première mesure d'un boîtier réel (None si aucun boîtier réel n'a encore envoyé de mesure).
    Tout ce qui précède (démonstration, simulateur) n'est jamais affiché."""
    now = time.time()
    if now - _real_cache["ts"] > 15 or _real_cache["since"] is None:
        with _lock:
            row = _db().execute(
                f"SELECT MIN(ts) FROM readings WHERE device_id NOT IN ({','.join('?' * len(DEMO_DEVICES))})",
                DEMO_DEVICES).fetchone()
        _real_cache.update(ts=now, since=row[0] if row and row[0] is not None else None)
    return _real_cache["since"]


def real_device_active():
    return real_since() is not None


def floor_ts():
    """Borne basse des arrosages / alertes affichés : la première vraie mesure (sinon « jamais »)."""
    s = real_since()
    return s - 60 if s is not None else time.time() + 10 * 365 * 86400


def source_filter():
    """Clause SQL : les mesures de démonstration et du simulateur ne sont jamais affichées."""
    return " AND device_id NOT IN (" + ",".join(f"'{d}'" for d in DEMO_DEVICES) + ")"


def latest_reading():
    with _lock:
        r = _db().execute(f"SELECT * FROM readings WHERE 1=1{source_filter()} ORDER BY ts DESC LIMIT 1").fetchone()
    return dict(r) if r else None


def latest_reading_for(device_id):
    with _lock:
        r = _db().execute("SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1", (device_id,)).fetchone()
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
            "INSERT INTO irrigation_events(ts_start, mode, reason, planned_s, moisture_before) "
            "VALUES (?, ?, ?, ?, ?)",
            (time.time(), mode, reason, planned_s, moisture_before),
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
        rows = c.execute("SELECT id, ts_start FROM irrigation_events WHERE ts_end IS NULL").fetchall()
        for r in rows:
            last = c.execute(
                "SELECT ts, soil_moisture FROM readings WHERE ts >= ? AND pump_on = 1 ORDER BY ts DESC LIMIT 1",
                (r["ts_start"],),
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
            "SELECT * FROM irrigation_events WHERE ts_start >= ? ORDER BY ts_start DESC LIMIT ?", (floor_ts(), limit)))


def last_finished_event():
    with _lock:
        r = _db().execute(
            "SELECT * FROM irrigation_events WHERE ts_end IS NOT NULL AND ts_start >= ? ORDER BY ts_end DESC LIMIT 1",
            (floor_ts(),)).fetchone()
    return dict(r) if r else None


def water_stats(seconds=86400):
    since = max(time.time() - seconds, floor_ts())
    with _lock:
        r = _db().execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS total_s "
            "FROM irrigation_events WHERE ts_start >= ?", (since,)
        ).fetchone()
    return dict(r)


def insert_event_raw(ts_start, ts_end, mode, reason, moisture_before, moisture_after):
    """Insère un arrosage déjà terminé (utilisé par le générateur d'historique)."""
    with _lock:
        c = _db()
        c.execute(
            "INSERT INTO irrigation_events(ts_start, ts_end, mode, reason, planned_s, duration_s, "
            "moisture_before, moisture_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ts_start, ts_end, mode, reason, ts_end - ts_start, ts_end - ts_start,
             moisture_before, moisture_after),
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


def user_by_id(uid):
    with _lock:
        r = _db().execute(f"SELECT {USER_FIELDS} FROM users WHERE id = ?", (uid,)).fetchone()
    return dict(r) if r else None


def create_user(email, name, password_hash=None, google_sub=None, picture=None):
    """Le tout premier compte devient propriétaire ; tous les comptes sont ouverts dès leur création."""
    with _lock:
        c = _db()
        first = c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        cur = c.execute(
            "INSERT INTO users(email, name, password_hash, google_sub, picture, role, status, created) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (email.lower(), name, password_hash, google_sub, picture,
             "owner" if first else "member", "active", time.time()),
        )
        c.commit()
        return cur.lastrowid


def update_user(uid, **fields):
    allowed = {"name", "password_hash", "google_sub", "picture", "status", "role", "last_login"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    with _lock:
        c = _db()
        c.execute(f"UPDATE users SET {', '.join(k + ' = ?' for k in sets)} WHERE id = ?", (*sets.values(), uid))
        c.commit()


def list_users():
    with _lock:
        return _rows(_db().execute(f"SELECT {USER_FIELDS} FROM users ORDER BY status DESC, created ASC"))


def delete_user(uid):
    with _lock:
        c = _db()
        c.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
        c.execute("DELETE FROM users WHERE id = ? AND role != 'owner'", (uid,))
        c.commit()


def add_session(token_hash, uid, days=30):
    now = time.time()
    with _lock:
        c = _db()
        c.execute("DELETE FROM sessions WHERE expires < ?", (now,))
        c.execute("INSERT INTO sessions(token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)",
                  (token_hash, uid, now, now + days * 86400))
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
            "INSERT INTO devices(id, first_seen, last_seen, ip, fw, rssi, uptime_s, readings, sensor, sensor_ok) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, "
            "ip=COALESCE(excluded.ip, ip), fw=COALESCE(excluded.fw, fw), "
            "rssi=COALESCE(excluded.rssi, rssi), uptime_s=COALESCE(excluded.uptime_s, uptime_s), "
            "sensor=COALESCE(excluded.sensor, sensor), sensor_ok=COALESCE(excluded.sensor_ok, sensor_ok), "
            "readings=readings + ?",
            (device_id, now, now, ip, fw, rssi, uptime_s, int(count), sensor, ok, int(count)),
        )
        c.commit()


def list_devices():
    with _lock:
        return _rows(_db().execute("SELECT * FROM devices ORDER BY last_seen DESC"))


def reset_measurements():
    """Sauvegarde la base puis efface mesures, arrosages, alertes et boîtiers (réglages et photos conservés)."""
    backup_dir = os.path.join(DATA_DIR, "sauvegardes")
    os.makedirs(backup_dir, exist_ok=True)
    path = os.path.join(backup_dir, time.strftime("smartfarm-%Y%m%d-%H%M%S.db"))
    with _lock:
        c = _db()
        dst = sqlite3.connect(path)
        c.backup(dst)
        dst.close()
        for t in ("readings", "irrigation_events", "alerts", "devices"):
            c.execute(f"DELETE FROM {t}")
        c.commit()
    return path


# ---------- statistiques ----------
def stats(days=7):
    since = max(time.time() - days * 86400, floor_ts())
    day = "date(ts, 'unixepoch', 'localtime')"
    src = source_filter()
    with _lock:
        c = _db()
        water = _rows(c.execute(
            "SELECT date(ts_start, 'unixepoch', 'localtime') AS day, COUNT(*) AS count, "
            "COALESCE(SUM(duration_s), 0) AS seconds FROM irrigation_events "
            "WHERE ts_start >= ? GROUP BY day ORDER BY day", (since,)))
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
    with _lock:
        c = _db()
        days = _rows(c.execute(
            f"SELECT {day} AS day, AVG(soil_moisture) AS m_avg, MIN(soil_moisture) AS m_min, MAX(soil_moisture) AS m_max, "
            f"MIN(air_temp) AS t_min, MAX(air_temp) AS t_max, AVG(air_humidity) AS rh, MAX(rain_detected) AS rain "
            f"FROM readings WHERE ts >= ? AND ts < ?{src} GROUP BY day ORDER BY day", (t0, t1)))
        water = {r["day"]: r for r in _rows(c.execute(
            "SELECT date(ts_start, 'unixepoch', 'localtime') AS day, COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS s "
            "FROM irrigation_events WHERE ts_start >= ? AND ts_start < ? GROUP BY day", (t0, t1)))}
        modes = _rows(c.execute(
            "SELECT mode, COUNT(*) AS n, COALESCE(SUM(duration_s), 0) AS s FROM irrigation_events "
            "WHERE ts_start >= ? AND ts_start < ? GROUP BY mode", (t0, t1)))
        alerts = _rows(c.execute(
            "SELECT ts, kind, level, title FROM alerts WHERE ts >= ? AND ts < ? ORDER BY ts DESC LIMIT 60", (t0, t1)))
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
        cur = c.execute("INSERT INTO photos(ts, file, caption, kind, colors, analysis_status) VALUES (?, ?, ?, ?, ?, ?)",
                        (time.time(), file, caption, kind, json.dumps(colors) if colors else None, "none"))
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
        return [_photo_row(r) for r in _db().execute("SELECT * FROM photos ORDER BY ts DESC").fetchall()]


def get_photo(photo_id):
    with _lock:
        r = _db().execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
    return _photo_row(r) if r else None


def set_photo_analysis(photo_id, status, analysis=None):
    with _lock:
        c = _db()
        c.execute("UPDATE photos SET analysis_status = ?, analysis = ? WHERE id = ?",
                  (status, json.dumps(analysis, ensure_ascii=False) if analysis is not None else None, photo_id))
        c.commit()


def delete_photo(photo_id):
    with _lock:
        c = _db()
        row = c.execute("SELECT file FROM photos WHERE id=?", (photo_id,)).fetchone()
        c.execute("DELETE FROM photos WHERE id=?", (photo_id,))
        c.commit()
    return row["file"] if row else None


# ---------- alertes ----------
def add_alert(kind, level, title, message, dedupe_seconds=6 * 3600):
    """Ajoute une alerte sauf si une alerte identique non acquittée existe déjà récemment."""
    with _lock:
        c = _db()
        dup = c.execute(
            "SELECT id FROM alerts WHERE kind=? AND title=? AND ack=0 AND ts >= ?",
            (kind, title, time.time() - dedupe_seconds),
        ).fetchone()
        if dup:
            return None
        cur = c.execute(
            "INSERT INTO alerts(ts, kind, level, title, message) VALUES (?, ?, ?, ?, ?)",
            (time.time(), kind, level, title, message),
        )
        c.commit()
        alert_id = cur.lastrowid
    if on_alert:
        try:
            on_alert(kind, level, title, message)
        except Exception as e:  # une notification ratée ne doit jamais bloquer l'enregistrement
            print(f"[alertes] {e!r}")
    return alert_id


on_alert = None   # rappel installé par le serveur (notifications Telegram)


def list_alerts(limit=50, only_open=False):
    q = "SELECT * FROM alerts WHERE ts >= ? " + ("AND ack=0 " if only_open else "") + "ORDER BY ts DESC LIMIT ?"
    with _lock:
        return _rows(_db().execute(q, (floor_ts(), limit)))


def ack_alert(alert_id):
    with _lock:
        c = _db()
        c.execute("UPDATE alerts SET ack=1 WHERE id=?", (alert_id,))
        c.commit()


# ---------- chat ----------
def add_chat(role, content, source=None):
    with _lock:
        c = _db()
        c.execute("INSERT INTO chat(ts, role, content, source) VALUES (?, ?, ?, ?)",
                  (time.time(), role, content, source))
        c.commit()


def chat_history(limit=20):
    with _lock:
        rows = _rows(_db().execute("SELECT * FROM chat ORDER BY id DESC LIMIT ?", (limit,)))
    return list(reversed(rows))


def clear_chat():
    with _lock:
        c = _db()
        c.execute("DELETE FROM chat")
        c.commit()
