"""Lecture du fichier .env du projet (smart_irrigation/.env) au démarrage du serveur.

Format : une variable par ligne, NOM=valeur. Les lignes vides et celles qui commencent par # sont ignorées.
Une variable déjà définie dans l'environnement Windows reste prioritaire.
"""
import os

PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))


def load(path=PATH):
    loaded = []
    if not os.path.exists(path):
        return loaded
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            name, value = name.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if name and value and name not in os.environ:
                os.environ[name] = value
                loaded.append(name)
    return loaded
