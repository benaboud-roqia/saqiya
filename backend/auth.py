"""Comptes utilisateurs : mots de passe (scrypt), sessions par cookie, connexion Google, anti-force brute."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request

import database as db

COOKIE = "saqiya_session"
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,}$")

# ---------- mots de passe ----------
def hash_password(password):
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def check_password(password, stored):
    try:
        _, salt_b64, dk_b64 = stored.split("$")
        dk = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except (ValueError, AttributeError):
        return False


def password_problem(password):
    if len(password) < 8:
        return "Le mot de passe doit faire au moins 8 caractères."
    if password.isdigit() or password.isalpha():
        return "Le mot de passe doit mélanger lettres et chiffres."
    return None


# ---------- sessions ----------
def _h(token):
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(uid):
    token = secrets.token_urlsafe(32)
    db.add_session(_h(token), uid)
    db.update_user(uid, last_login=time.time())
    return token


def user_from_cookie(cookie_header):
    token = read_cookie(cookie_header)
    return db.session_user(_h(token)) if token else None


def end_session(cookie_header):
    token = read_cookie(cookie_header)
    if token:
        db.delete_session(_h(token))


def read_cookie(cookie_header):
    for part in (cookie_header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == COOKIE and v:
            return v
    return None


def cookie_header(token, max_age=30 * 86400):
    return f"{COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Lax"


# ---------- anti-force brute : 8 échecs / 10 min par adresse ----------
_fails, _lock = {}, threading.Lock()


def too_many(ip):
    now = time.time()
    with _lock:
        lst = [t for t in _fails.get(ip, []) if now - t < 600]
        _fails[ip] = lst
        return len(lst) >= 8


def record_fail(ip):
    with _lock:
        _fails.setdefault(ip, []).append(time.time())


def clear_fails(ip):
    with _lock:
        _fails.pop(ip, None)


# ---------- Google ----------
def google_client_id():
    # ID client OAuth « Application Web » de Google Cloud Console : fichier .env (GOOGLE_CLIENT_ID=…) ou Réglages › Comptes
    return (os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("SAQIYA_GOOGLE_CLIENT_ID")
            or db.get_settings().get("google_client_id") or "")


def google_origins():
    """Adresses ajoutées dans Google Cloud Console › « Origines JavaScript autorisées ».
    Sur une autre adresse (tunnel en ligne…), Google affiche « Accès bloqué » : le bouton y est donc masqué.
    Fichier .env : GOOGLE_ORIGINS=http://localhost:8000,http://localhost,https://mon-adresse-fixe"""
    raw = os.environ.get("GOOGLE_ORIGINS") or "http://localhost:8000,http://localhost"
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def verify_google(credential):
    """Vérifie le jeton d'identité Google auprès de Google et renvoie (email, nom, sub, photo)."""
    cid = google_client_id()
    if not cid:
        raise ValueError("Connexion Google non configurée.")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            info = json.loads(r.read().decode())
    except Exception:
        raise ValueError("Google n'a pas validé la connexion.")
    if info.get("aud") != cid or info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Jeton Google destiné à une autre application.")
    if str(info.get("email_verified")).lower() != "true":
        raise ValueError("Adresse Gmail non vérifiée.")
    if int(info.get("exp", 0)) < time.time():
        raise ValueError("Connexion Google expirée, recommencez.")
    return info["email"].lower(), info.get("name") or info["email"].split("@")[0], info["sub"], info.get("picture")


def public_user(u):
    if not u:
        return None
    return {k: u.get(k) for k in ("id", "email", "name", "picture", "role", "status", "has_password", "has_google")}
