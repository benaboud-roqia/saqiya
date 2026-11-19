"""Moteur d'irrigation automatique (section 3.1 du cahier des charges).

Étape 1 – règles : si l'humidité du sol < seuil ET pas de pluie (capteur + prévisions)
           -> démarrer la pompe.
Étape 2 – apprentissage : après chaque arrosage, le système mesure le gain d'humidité
           obtenu et ajuste automatiquement la durée de pompage (secondes par % d'humidité).
           Une régression linéaire sur l'historique prédit l'heure du prochain arrosage.
"""
import threading
import time

import database as db
import knowledge

_lock = threading.RLock()
_pump = {"on": False, "until": 0.0, "event_id": None, "mode": None, "started": 0.0}
_last_decision = {"action": "attente", "reason": "Aucune mesure reçue pour l'instant.", "ts": 0}


def thresholds(settings, reading=None):
    """Retourne (seuil de déclenchement, cible) en % d'humidité du sol."""
    s = knowledge.soil(settings["soil_type"])
    c = knowledge.crop(settings["crop"])
    threshold = s["threshold"] + c.get("moisture_offset", 0)
    target = s["target"] + c.get("moisture_offset", 0)
    # forte demande évaporative : on vise un peu plus haut
    if reading and (reading.get("air_temp") or 0) > 32 and (reading.get("air_humidity") or 100) < 40:
        target += 3
    if settings.get("threshold_override") not in (None, ""):
        threshold = float(settings["threshold_override"])
        target = max(target, threshold + 10)
    return round(threshold, 1), round(target, 1)


def pump_state():
    with _lock:
        now = time.time()
        # échéance dépassée sans nouvelle mesure du boîtier : on clôt l'arrosage quand même
        if _pump["on"] and now >= _pump["until"]:
            latest = db.latest_reading() or {}
            _stop(latest.get("soil_moisture"), db.get_settings())
            _decide("arrêt", "Durée d'arrosage atteinte.")
        return {
            "on": _pump["on"],
            "mode": _pump["mode"],
            "seconds_remaining": max(0, int(_pump["until"] - now)) if _pump["on"] else 0,
            "running_for_s": int(now - _pump["started"]) if _pump["on"] else 0,
        }


def last_decision():
    return dict(_last_decision)


def _decide(action, reason):
    _last_decision.update({"action": action, "reason": reason, "ts": time.time()})


on_event = None   # rappel (notifications) : on_event(started, mode, seconds, moisture)


def _notify(*args):
    if on_event:
        try:
            on_event(*args)
        except Exception as e:
            print(f"[irrigation] notification : {e!r}")


def _start(duration_s, mode, reason, moisture):
    _pump.update({
        "on": True, "until": time.time() + duration_s, "mode": mode, "started": time.time(),
        "event_id": db.start_event(mode, reason, duration_s, moisture),
    })
    _notify(True, mode, duration_s, moisture)


def _stop(moisture, settings):
    event = db.end_event(_pump["event_id"], moisture) if _pump["event_id"] else None
    _pump.update({"on": False, "until": 0.0, "event_id": None, "mode": None, "started": 0.0})
    if event:
        _learn(event, settings)
        _notify(False, event.get("mode"), event.get("duration_s"), moisture)
    return event


# ---------- programmation horaire ----------
def _minutes(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def in_window(settings, now=None):
    """Vrai si l'arrosage automatique est permis maintenant (créneaux désactivés = toujours permis)."""
    if not settings.get("windows_enabled") or not settings.get("windows"):
        return True, None
    t = time.localtime(now or time.time())
    cur = t.tm_hour * 60 + t.tm_min
    starts = []
    for w in settings["windows"]:
        a, b = _minutes(w["start"]), _minutes(w["end"])
        if (a <= cur < b) if a <= b else (cur >= a or cur < b):   # créneau qui passe minuit
            return True, None
        starts.append((a - cur) % 1440)
    nxt = min(starts) if starts else None
    return False, None if nxt is None else time.strftime("%H:%M", time.localtime((now or time.time()) + nxt * 60))


def run_schedules(weather):
    """Appelée chaque minute : lance les arrosages programmés à l'heure dite."""
    settings = db.get_settings()
    t = time.localtime()
    hhmm, today = f"{t.tm_hour:02d}:{t.tm_min:02d}", time.strftime("%Y-%m-%d")
    for i, sc in enumerate(settings.get("schedules") or []):
        if not sc.get("on", True) or sc.get("time") != hhmm or t.tm_wday not in sc.get("days", range(7)):
            continue
        key = f"{today}-{i}-{hhmm}"
        if _done_schedules.get(key):
            continue
        _done_schedules[key] = True
        latest = db.latest_reading() or {}
        m = latest.get("soil_moisture")
        _, target = thresholds(settings, latest)
        with _lock:
            if _pump["on"]:
                continue
            if sc.get("only_if_dry", True) and m is not None and m >= target:
                _decide("reporté", f"Arrosage programmé de {hhmm} annulé : sol déjà humide ({m:.1f} % ≥ {target} %).")
                continue
            if weather.get("available") and weather.get("rain_next_12h_mm", 0) >= settings["rain_mm_skip"]:
                _decide("reporté", f"Arrosage programmé de {hhmm} annulé : pluie prévue ({weather['rain_next_12h_mm']} mm).")
                continue
            dur = int(max(60, min(float(sc.get("minutes", 10)) * 60, float(settings["max_duration_s"]) * 2)))
            _start(dur, "programmé", f"Arrosage programmé de {hhmm} ({dur // 60} min).", m)
            _decide("arrosage", f"Arrosage programmé de {hhmm} pendant {dur // 60} min.")


_done_schedules = {}


def _learn(event, settings):
    """Ajuste 'sec_per_percent' à partir du gain d'humidité réellement observé."""
    before, after, dur = event.get("moisture_before"), event.get("moisture_after"), event.get("duration_s")
    if before is None or after is None or not dur:
        return
    gain = after - before
    if gain < 1.0 or dur < 5:
        return
    observed = dur / gain
    old = float(settings["sec_per_percent"])
    new = max(1.0, min(300.0, 0.7 * old + 0.3 * observed))
    db.update_settings({"sec_per_percent": round(new, 2)})


def manual(action, duration_s=None):
    """Commande manuelle depuis le tableau de bord."""
    settings = db.get_settings()
    latest = db.latest_reading() or {}
    moisture = latest.get("soil_moisture")
    with _lock:
        if action == "on":
            dur = int(duration_s or 300)
            dur = max(10, min(dur, int(settings["max_duration_s"])))
            if _pump["on"]:
                _stop(moisture, settings)
            _start(dur, "manuel", "Démarrage manuel", moisture)
            _decide("arrosage", f"Arrosage manuel pendant {dur} s.")
        elif action == "off":
            if _pump["on"]:
                _stop(moisture, settings)
            _decide("arrêt", "Pompe arrêtée manuellement.")
    return pump_state()


def process_reading(reading, weather):
    """Appelée à chaque nouvelle mesure. Retourne l'état de pompe à envoyer au boîtier."""
    settings = db.get_settings()
    moisture = reading.get("soil_moisture")
    threshold, target = thresholds(settings, reading)
    now = time.time()

    with _lock:
        # 1) une irrigation est en cours : faut-il l'arrêter ?
        if _pump["on"]:
            if now >= _pump["until"]:
                _stop(moisture, settings)
                _decide("arrêt", "Durée d'arrosage atteinte.")
            elif _pump["mode"] == "auto" and moisture is not None and moisture >= target:
                _stop(moisture, settings)
                _decide("arrêt", f"Humidité cible atteinte ({moisture:.1f} % ≥ {target} %).")
            elif _pump["mode"] == "auto" and reading.get("rain_detected"):
                _stop(moisture, settings)
                _decide("arrêt", "Pluie détectée pendant l'arrosage : arrêt de la pompe.")
            return pump_state()

        if settings["mode"] != "auto":
            _decide("attente", "Mode manuel : aucune décision automatique.")
            return pump_state()
        if moisture is None:
            _decide("attente", "Capteur d'humidité du sol indisponible.")
            return pump_state()

        # 2) faut-il démarrer ?
        if moisture >= threshold:
            _decide("attente", f"Sol suffisamment humide ({moisture:.1f} % ≥ seuil {threshold} %).")
            return pump_state()
        if reading.get("rain_detected"):
            _decide("reporté", "Sol sec mais il pleut actuellement : arrosage annulé.")
            return pump_state()
        if weather.get("available"):
            rain_mm = weather.get("rain_next_12h_mm", 0)
            rain_p = weather.get("rain_prob_max_12h", 0)
            if rain_mm >= settings["rain_mm_skip"] or rain_p >= settings["rain_prob_skip"]:
                _decide("reporté", f"Sol sec ({moisture:.1f} %) mais pluie prévue "
                                   f"({rain_mm:.1f} mm, {rain_p:.0f} %) dans les 12 h : économie d'eau.")
                return pump_state()
        allowed, next_window = in_window(settings, now)
        if not allowed:
            _decide("reporté", f"Sol sec ({moisture:.1f} %) mais hors des créneaux d'arrosage"
                               + (f" : prochain créneau à {next_window}." if next_window else "."))
            return pump_state()
        last = db.last_finished_event()
        if last and now - last["ts_end"] < settings["min_interval_min"] * 60:
            wait = int((settings["min_interval_min"] * 60 - (now - last["ts_end"])) / 60) + 1
            _decide("reporté", f"Sol sec mais dernier arrosage trop récent (attendre ~{wait} min "
                               "pour que l'eau diffuse).")
            return pump_state()

        deficit = target - moisture
        duration = int(max(30, min(deficit * float(settings["sec_per_percent"]),
                                   float(settings["max_duration_s"]))))
        reason = (f"Humidité {moisture:.1f} % < seuil {threshold} %, pas de pluie prévue. "
                  f"Objectif {target} % → {duration} s de pompe.")
        _start(duration, "auto", reason, moisture)
        _decide("arrosage", reason)
        return pump_state()


def predict_next_irrigation(settings):
    """Régression linéaire de l'humidité (pompe arrêtée, 6 dernières heures)."""
    # on ne garde que la phase de séchage depuis la fin du dernier arrosage
    last = db.last_finished_event()
    since = last["ts_end"] + 60 if last else 0
    rows = [r for r in db.readings_since(6 * 3600)
            if not r["pump_on"] and r["soil_moisture"] is not None and r["ts"] >= since]
    if len(rows) < 5:
        return {"available": False, "message": "Pas assez d'historique depuis le dernier arrosage."}
    t0 = rows[0]["ts"]
    xs = [(r["ts"] - t0) / 3600 for r in rows]
    ys = [r["soil_moisture"] for r in rows]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return {"available": False, "message": "Pas assez d'historique."}
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx  # % par heure
    threshold, _ = thresholds(settings, rows[-1])
    current = ys[-1]
    result = {"available": True, "drying_rate_per_h": round(-slope, 2)}
    if slope >= -0.05:
        result.update({"hours": None, "message": "Humidité stable ou en hausse."})
    elif current <= threshold:
        result.update({"hours": 0, "message": "Seuil déjà atteint."})
    else:
        hours = (current - threshold) / (-slope)
        result.update({"hours": round(hours, 1),
                       "eta_ts": time.time() + hours * 3600,
                       "message": f"Prochain arrosage estimé dans ~{hours:.1f} h."})
    return result
