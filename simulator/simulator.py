"""Simulateur du boîtier IoT (remplace l'ESP32 et ses capteurs pour les tests).

Il envoie périodiquement au serveur les mêmes données que le vrai boîtier :
humidité / température / pH / EC / NPK du sol, température et humidité de l'air, pluie.
Il applique la commande de pompe renvoyée par le serveur (l'humidité du sol remonte).

Exemples :
    python simulator/simulator.py                      # scénario normal
    python simulator/simulator.py --scenario humide    # nuits humides -> risque de mildiou
    python simulator/simulator.py --scenario sec --speed 120
"""
import argparse
import json
import math
import random
import time
import urllib.error
import urllib.request


def main():
    ap = argparse.ArgumentParser(description="Simulateur de capteurs IoT")
    ap.add_argument("--server", default="http://127.0.0.1:8000")
    ap.add_argument("--key", default="change-me", help="clé du boîtier (Réglages du tableau de bord)")
    ap.add_argument("--interval", type=float, default=3.0, help="secondes réelles entre deux envois")
    ap.add_argument("--speed", type=float, default=60.0,
                    help="accélération du temps pour la météo et le séchage du sol (60 = 1 min réelle = 1 h)")
    ap.add_argument("--pump-rate", type=float, default=1 / 25,
                    help="%% d'humidité gagné par seconde réelle de pompe")
    ap.add_argument("--scenario", choices=["normal", "humide", "sec"], default="normal")
    ap.add_argument("--moisture", type=float, default=36.0, help="humidité initiale du sol (%%)")
    args = ap.parse_args()

    rnd = random.Random()
    sim_t = time.time()
    moisture = args.moisture
    soil = {"ph": 6.6, "ec": 1.1, "n": 26.0, "p": 21.0, "k": 170.0}
    pump_on = False
    raining_until = 0.0
    print(f"Simulateur démarré → {args.server}  (scénario {args.scenario}, vitesse x{args.speed:g})")

    while True:
        dt_real = args.interval
        dt_sim = dt_real * args.speed
        sim_t += dt_sim
        hour = time.localtime(sim_t).tm_hour + time.localtime(sim_t).tm_min / 60

        # --- climat (cycle jour/nuit) ---
        day = math.sin((hour - 9) / 24 * 2 * math.pi)          # max vers 15 h
        if args.scenario == "humide":
            temp = 18 + 4 * day + rnd.gauss(0, 0.4)
            rh = 92 - 10 * day + rnd.gauss(0, 1.2)
        elif args.scenario == "sec":
            temp = 29 + 8 * day + rnd.gauss(0, 0.5)
            rh = 35 - 12 * day + rnd.gauss(0, 2)
        else:
            temp = 23 + 7 * day + rnd.gauss(0, 0.5)
            rh = 62 - 18 * day + rnd.gauss(0, 2)
        rh = max(10, min(99.5, rh))

        # --- pluie aléatoire (rare) ---
        if sim_t > raining_until and rnd.random() < (0.004 if args.scenario != "sec" else 0.0005):
            raining_until = sim_t + rnd.uniform(1, 3) * 3600
        raining = sim_t < raining_until

        # --- bilan hydrique du sol ---
        et_per_h = 0.35 + 0.06 * max(0, temp - 12) * (1 - rh / 100) * 3   # évapotranspiration %/h
        moisture -= et_per_h * dt_sim / 3600
        if raining:
            moisture += 2.5 * dt_sim / 3600
            rh = max(rh, 95)
        if pump_on:
            moisture += args.pump_rate * dt_real
        moisture = max(5, min(95, moisture))

        # --- fertilité : lente consommation des éléments ---
        soil["n"] = max(5, soil["n"] - 0.02 * dt_sim / 3600)
        soil["k"] = max(50, soil["k"] - 0.05 * dt_sim / 3600)

        payload = {
            "device_id": "esp32-simulateur",
            "soil_moisture": round(moisture + rnd.gauss(0, 0.3), 1),
            "soil_temp": round(temp - 3 + rnd.gauss(0, 0.2), 1),
            "soil_ph": round(soil["ph"] + rnd.gauss(0, 0.03), 2),
            "soil_ec": round(soil["ec"] + rnd.gauss(0, 0.02), 2),
            "n": round(soil["n"] + rnd.gauss(0, 0.5)),
            "p": round(soil["p"] + rnd.gauss(0, 0.5)),
            "k": round(soil["k"] + rnd.gauss(0, 2)),
            "air_temp": round(temp, 1),
            "air_humidity": round(rh, 1),
            "rain_detected": 1 if raining else 0,
        }
        req = urllib.request.Request(
            args.server.rstrip("/") + "/api/readings",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "X-Device-Key": args.key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                resp = json.loads(r.read().decode())
            pump_on = bool(resp.get("pump"))
            print(f"[{time.strftime('%H:%M', time.localtime(sim_t))} simulé] sol {payload['soil_moisture']:5.1f} % | "
                  f"air {payload['air_temp']:4.1f} °C {payload['air_humidity']:4.1f} % | pluie {payload['rain_detected']} | "
                  f"pompe {'ON ' if pump_on else 'OFF'} | {resp.get('decision', '')}")
        except urllib.error.HTTPError as e:
            print(f"Erreur serveur {e.code} : {e.read().decode(errors='ignore')}")
            if e.code == 401:
                print("→ Vérifiez la clé du boîtier (--key).")
        except Exception as e:
            print(f"Serveur injoignable ({e}). Nouvel essai…")
        time.sleep(dt_real)


if __name__ == "__main__":
    main()
