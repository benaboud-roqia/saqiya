"""Fournisseur d'IA : Groq (par défaut) ou Claude. Groq est appelé par son API REST (compatible OpenAI)."""
import json
import os
import re
import urllib.error
import urllib.request

import database as db

GROQ_URL = "https://api.groq.com/openai/v1"
# modèles préférés, du meilleur au plus courant ; le premier réellement disponible sur le compte est choisi
GROQ_CHAT_PREF = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"]
GROQ_VISION_PREF = ["qwen/qwen3.8-27b", "meta-models/muse-spark-open", "meta-llama/llama-4-scout-17b-16e-instruct",
                    "meta-llama/llama-4-maverick-17b-128e-instruct"]


class AIError(Exception):
    pass


def settings():
    return db.get_settings()


def provider(s=None):
    if os.environ.get("GROQ_API_KEY"):          # clé dans le fichier .env : Groq est utilisé
        return "groq"
    s = s or settings()
    if s.get("ai_provider") == "claude":
        return "claude"
    return "groq"


_auto = {"key": None, "chat": None, "vision": None}


def auto_models(key):
    """Modèles Groq réellement disponibles sur le compte (lus une fois, puis gardés en mémoire)."""
    if _auto["key"] != key:
        chat, vision = pick_models(groq_models(key))
        _auto.update(key=key, chat=chat, vision=vision)
    return _auto["chat"], _auto["vision"]


def groq_key(s=None):
    return os.environ.get("GROQ_API_KEY") or (s or settings()).get("groq_api_key") or ""


def claude_key(s=None):
    return os.environ.get("ANTHROPIC_API_KEY") or (s or settings()).get("anthropic_api_key") or ""


def available(s=None):
    s = s or settings()
    if provider(s) == "groq":
        return bool(groq_key(s))
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(claude_key(s))


def _groq_request(method, path, key, payload=None, timeout=60):
    req = urllib.request.Request(f"{GROQ_URL}{path}", method=method,
                                 data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                          "User-Agent": "saqiya/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:300]
        if e.code == 401:
            raise AIError("Clé Groq refusée : vérifiez GROQ_API_KEY dans le fichier .env.")
        if e.code == 429:
            raise AIError("Limite Groq atteinte (trop de demandes) : réessayez dans une minute.")
        if e.code == 404 or "model" in body and "not" in body:
            raise AIError("Modèle Groq indisponible : réenregistrez la clé pour choisir un modèle à jour.")
        raise AIError(f"Erreur Groq {e.code} : {body}")
    except urllib.error.URLError:
        raise AIError("Pas de connexion à Internet : réessayez dans un instant.")


def groq_models(key):
    data = _groq_request("GET", "/models", key, timeout=15)
    return [m["id"] for m in data.get("data", []) if m.get("active", True)]


def pick_models(ids):
    chat = next((m for m in GROQ_CHAT_PREF if m in ids), None) or next((m for m in ids if "llama" in m or "gpt-oss" in m), None)
    vision = next((m for m in GROQ_VISION_PREF if m in ids), None) or next(
        (m for m in ids if any(w in m for w in ("vision", "scout", "maverick", "qwen3", "-vl"))), None)
    return chat, vision


def _clean(text):
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def groq_chat(messages, json_mode=False, vision=False, max_tokens=2000):
    s = settings()
    key = groq_key(s)
    if not key:
        raise AIError("Clé Groq absente : ajoutez-la dans le fichier .env (GROQ_API_KEY=…) puis relancez le serveur.")
    model = s.get("groq_vision_model") if vision else s.get("groq_chat_model")
    if not model or os.environ.get("GROQ_API_KEY"):
        chat_m, vision_m = auto_models(key)
        model = (vision_m if vision else chat_m) or model or (GROQ_VISION_PREF if vision else GROQ_CHAT_PREF)[0]
    payload = {"model": model, "messages": messages, "temperature": 0.2 if json_mode else 0.5, "max_completion_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    data = _groq_request("POST", "/chat/completions", key, payload)
    return _clean(data["choices"][0]["message"].get("content")), model
