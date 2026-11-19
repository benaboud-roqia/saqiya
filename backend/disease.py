"""Prédiction des maladies des plantes (section 3.2 du cahier des charges).

Modèle : classifieur bayésien naïf gaussien (implémenté en Python pur) qui reconnaît
les conditions favorables à chaque maladie AVANT l'apparition des symptômes.

Variables d'entrée (calculées sur l'historique des capteurs) :
  - temp        : température moyenne de l'air sur 6 h (°C)
  - rh          : humidité moyenne de l'air sur 6 h (%)
  - wet_hours   : nombre d'heures avec humidité ≥ 90 % sur 24 h (humectation du feuillage)
  - soil_excess : humidité du sol – humidité cible de la parcelle (%)

Données d'entraînement : data/disease_dataset.csv. S'il n'existe pas, un jeu de données
synthétique est généré à partir des conditions épidémiologiques connues de chaque maladie.
Remplacez-le par vos propres observations de terrain (mêmes colonnes) pour améliorer le modèle.
"""
import csv
import math
import os
import random

import database as db
import knowledge
from irrigation import thresholds

FEATURES = ["temp", "rh", "wet_hours", "soil_excess"]
DATASET = os.path.join(db.DATA_DIR, "disease_dataset.csv")

# (moyenne, écart-type) de chaque variable pour chaque classe + nombre d'exemples générés
PROTOTYPES = {
    "sain":                 ({"temp": (24, 7), "rh": (55, 13), "wet_hours": (2, 2), "soil_excess": (-3, 8)}, 1200),
    "mildiou":              ({"temp": (18, 3.5), "rh": (93, 3), "wet_hours": (13, 3), "soil_excess": (0, 8)}, 400),
    "oidium":               ({"temp": (25, 3), "rh": (62, 7), "wet_hours": (2, 1.5), "soil_excess": (-4, 8)}, 400),
    "botrytis":             ({"temp": (20, 3), "rh": (95, 2), "wet_hours": (16, 3), "soil_excess": (3, 8)}, 400),
    "rouille":              ({"temp": (19, 3), "rh": (88, 3), "wet_hours": (8, 2), "soil_excess": (0, 8)}, 400),
    "pourriture_racinaire": ({"temp": (25, 4), "rh": (70, 12), "wet_hours": (5, 4), "soil_excess": (18, 6)}, 400),
}


def generate_dataset(path=DATASET, seed=42):
    rnd = random.Random(seed)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(FEATURES + ["label"])
        for label, (proto, count) in PROTOTYPES.items():
            for _ in range(count):
                row = []
                for feat in FEATURES:
                    mu, sd = proto[feat]
                    v = rnd.gauss(mu, sd)
                    if feat == "rh":
                        v = min(100, max(5, v))
                    if feat == "wet_hours":
                        v = min(24, max(0, v))
                    row.append(round(v, 2))
                w.writerow(row + [label])


class GaussianNB:
    def fit(self, X, y):
        self.classes = sorted(set(y))
        self.stats, self.priors = {}, {}
        for c in self.classes:
            rows = [x for x, label in zip(X, y) if label == c]
            self.priors[c] = len(rows) / len(X)
            cols = list(zip(*rows))
            means = [sum(col) / len(col) for col in cols]
            vars_ = [max(1e-3, sum((v - m) ** 2 for v in col) / len(col)) for col, m in zip(cols, means)]
            self.stats[c] = (means, vars_)
        return self

    def predict_proba(self, x):
        logp = {}
        for c in self.classes:
            means, vars_ = self.stats[c]
            lp = math.log(self.priors[c])
            for v, m, var in zip(x, means, vars_):
                lp += -0.5 * math.log(2 * math.pi * var) - (v - m) ** 2 / (2 * var)
            logp[c] = lp
        mx = max(logp.values())
        exp = {c: math.exp(v - mx) for c, v in logp.items()}
        tot = sum(exp.values())
        return {c: e / tot for c, e in exp.items()}


def _load_model():
    if not os.path.exists(DATASET):
        generate_dataset()
    X, y = [], []
    with open(DATASET, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            X.append([float(row[k]) for k in FEATURES])
            y.append(row["label"])
    model = GaussianNB().fit(X, y)
    # précision sur le jeu d'entraînement (indicatif)
    correct = sum(1 for xi, yi in zip(X, y)
                  if max(model.predict_proba(xi).items(), key=lambda kv: kv[1])[0] == yi)
    model.train_accuracy = round(correct / len(X) * 100, 1)
    model.n_samples = len(X)
    return model


MODEL = _load_model()


def features_from_history(settings):
    rows24 = [r for r in db.readings_since(24 * 3600) if r["air_humidity"] is not None]
    if not rows24:
        return None
    rows6 = [r for r in rows24 if r["ts"] >= rows24[-1]["ts"] - 6 * 3600] or rows24[-1:]
    temp = sum(r["air_temp"] for r in rows6) / len(rows6)
    rh = sum(r["air_humidity"] for r in rows6) / len(rows6)
    wet_frac = sum(1 for r in rows24 if r["air_humidity"] >= 90) / len(rows24)
    _, target = thresholds(settings, rows24[-1])
    soil = rows24[-1]["soil_moisture"] if rows24[-1]["soil_moisture"] is not None else target
    return {
        "temp": round(temp, 1), "rh": round(rh, 1),
        # part du temps passé à HR ≥ 90 %, ramenée à 24 h (extrapolée si l'historique est court)
        "wet_hours": round(wet_frac * 24, 1),
        "soil_excess": round(soil - target, 1),
    }


def level_of(pct):
    return "élevé" if pct >= 60 else "moyen" if pct >= 35 else "faible"


def assess(settings=None, create_alerts=True):
    settings = settings or db.get_settings()
    feats = features_from_history(settings)
    if feats is None:
        return {"available": False, "message": "Pas encore de mesures."}
    proba = MODEL.predict_proba([feats[k] for k in FEATURES])
    crop = knowledge.crop(settings["crop"])
    risks = []
    for name in crop["diseases"]:
        pct = round(proba.get(name, 0) * 100, 1)
        d = knowledge.disease(name)
        risks.append({
            "disease": name, "label": d.get("label", name), "risk": pct, "level": level_of(pct),
            "conditions": d.get("conditions"), "prevention": d.get("prevention"),
            "treatment": d.get("treatment"),
        })
    risks.sort(key=lambda r: r["risk"], reverse=True)

    if create_alerts:
        for r in risks:
            if r["level"] == "élevé":
                db.add_alert(
                    "maladie", "danger", f"Risque élevé : {r['label']}",
                    f"Conditions favorables détectées ({r['risk']} %). "
                    f"Prévention : {r['prevention']}",
                )
    return {
        "available": True, "features": feats, "risks": risks,
        "healthy_prob": round(proba.get("sain", 0) * 100, 1),
        "model": {"type": "Bayésien naïf gaussien", "samples": MODEL.n_samples,
                  "train_accuracy": MODEL.train_accuracy},
    }
