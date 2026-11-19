"""Génère un historique réaliste (par défaut 7 jours) dans la base, pour la démonstration.

Les graphiques de la vue « Analyses » ont ainsi des données dès le premier lancement.
Les mesures sont marquées avec device_id = "historique-demo".

    python simulator/generer_historique.py            # 7 jours, un relevé toutes les 10 min
    python simulator/generer_historique.py --jours 14
"""
import argparse
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
import database as db  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jours", type=int, default=7)
    ap.add_argument("--pas", type=int, default=10, help="minutes entre deux relevés")
    args = ap.parse_args()

    db.init()
    with db._lock:
        c = db._db()
        old = c.execute("SELECT COUNT(*) FROM readings WHERE device_id='historique-demo'").fetchone()[0]
    if old:
        print(f"Un historique de démonstration existe déjà ({old} relevés). Rien à faire.")
        return

    rnd = random.Random(7)
    first_real = None
    with db._lock:
        r = db._db().execute("SELECT MIN(ts) FROM readings").fetchone()[0]
        first_real = r
    end = (first_real or time.time()) - 60
    t = end - args.jours * 86400
    step = args.pas * 60
    moisture, n, p, k = 44.0, 34.0, 24.0, 205.0
    rain_until, humid_until = 0, 0
    pump_until, ev_start, ev_before = 0, None, None
    last_end = 0
    count = 0

    while t < end:
        lt = time.localtime(t)
        hour = lt.tm_hour + lt.tm_min / 60
        day = math.sin((hour - 9) / 24 * 2 * math.pi)
        if t > humid_until and rnd.random() < 0.0025:
            humid_until = t + rnd.uniform(8, 16) * 3600       # épisode de nuits humides
        humid = t < humid_until
        temp = (18 if humid else 23) + (4 if humid else 7) * day + rnd.gauss(0, 0.5)
        rh = (90 if humid else 62) - (8 if humid else 18) * day + rnd.gauss(0, 2)
        if t > rain_until and rnd.random() < 0.002:
            rain_until = t + rnd.uniform(1, 3) * 3600
        raining = t < rain_until
        rh = min(99, max(15, 96 if raining else rh))

        et = 0.35 + 0.06 * max(0, temp - 12) * (1 - rh / 100) * 3
        moisture -= et * step / 3600
        if raining:
            moisture += 2.5 * step / 3600
        pump_on = t < pump_until
        if pump_on:
            moisture += step / 25
        elif ev_start is not None:
            db.insert_event_raw(ev_start, pump_until, "auto",
                                f"Humidité {ev_before:.1f} % < seuil 32 %, pas de pluie prévue.",
                                ev_before, round(moisture, 1))
            last_end, ev_start = pump_until, None
        moisture = max(8, min(90, moisture))
        if not pump_on and not raining and moisture < 32 and t - last_end > 3600:
            dur = (47 - moisture) * 25
            pump_until, ev_start, ev_before = t + dur, t, round(moisture, 1)
            pump_on = True

        n = max(8, n - 0.012 * step / 60)
        k = max(60, k - 0.02 * step / 60)
        db.insert_reading("historique-demo", {
            "soil_moisture": round(moisture + rnd.gauss(0, 0.3), 1),
            "soil_temp": round(temp - 3, 1), "soil_ph": round(6.6 + rnd.gauss(0, 0.04), 2),
            "soil_ec": round(1.1 + rnd.gauss(0, 0.03), 2),
            "n": round(n), "p": round(p + rnd.gauss(0, 0.5)), "k": round(k),
            "air_temp": round(temp, 1), "air_humidity": round(rh, 1), "rain_detected": int(raining),
        }, pump_on, ts=t)
        count += 1
        t += step
    print(f"{count} relevés générés sur {args.jours} jours.")


if __name__ == "__main__":
    main()
