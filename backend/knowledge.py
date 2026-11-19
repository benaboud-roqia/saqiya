"""Chargement de la base de connaissances agricole."""
import json
import os

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base.json")

with open(_PATH, encoding="utf-8") as f:
    KB = json.load(f)


def crop(name):
    return KB["crops"].get(name) or KB["crops"]["tomate"]


def soil(name):
    return KB["soil_types"].get(name) or KB["soil_types"]["limoneux"]


def disease(name):
    return KB["diseases"].get(name, {})
