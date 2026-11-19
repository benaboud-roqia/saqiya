"""Prévisions météo via l'API gratuite Open-Meteo (sans clé). Cache de 30 minutes."""
import json
import threading
import time
import urllib.parse
import urllib.request

_cache = {"key": None, "ts": 0, "data": None}
_lock = threading.Lock()
TTL = 30 * 60


def forecast(lat, lon):
    key = (round(float(lat), 3), round(float(lon), 3))
    with _lock:
        if _cache["key"] == key and time.time() - _cache["ts"] < TTL and _cache["data"]:
            return _cache["data"]
    params = urllib.parse.urlencode({
        "latitude": key[0], "longitude": key[1],
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "hourly": "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability",
        "forecast_hours": 24, "timezone": "auto",
    })
    try:
        with urllib.request.urlopen(f"https://api.open-meteo.com/v1/forecast?{params}", timeout=8) as r:
            raw = json.loads(r.read().decode())
        h = raw["hourly"]
        precip = [p or 0 for p in h["precipitation"]]
        prob = [p or 0 for p in h.get("precipitation_probability", [])] or [0]
        data = {
            "available": True,
            "current": raw.get("current", {}),
            "rain_next_12h_mm": round(sum(precip[:12]), 1),
            "rain_next_24h_mm": round(sum(precip[:24]), 1),
            "rain_prob_max_12h": max(prob[:12]) if prob else 0,
            "hourly": [
                {"time": t, "temp": te, "rh": rh, "rain_mm": pr, "rain_prob": pp}
                for t, te, rh, pr, pp in zip(h["time"], h["temperature_2m"], h["relative_humidity_2m"],
                                             precip, prob + [0] * (len(precip) - len(prob)))
            ],
            "fetched_at": time.time(),
        }
    except Exception as e:  # réseau absent, API indisponible...
        data = {"available": False, "error": str(e), "rain_next_12h_mm": 0,
                "rain_prob_max_12h": 0, "fetched_at": time.time()}
    with _lock:
        _cache.update({"key": key, "ts": time.time() if data["available"] else time.time() - TTL + 120,
                       "data": data})
    return data
