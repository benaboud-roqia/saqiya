"""Alertes sur le téléphone via Telegram (gratuit) : alertes du système, pompe, boîtier hors ligne, résumé du matin.

Mise en place : créer un bot avec @BotFather, coller son jeton dans Paramètres › Alertes, écrire /start
au bot depuis son téléphone, puis « Détecter mon compte ». Les envois partent dans un fil séparé :
une panne d'Internet ne ralentit jamais l'irrigation.
"""
import json
import os
import queue
import re
import threading
import time
import urllib.error
import urllib.request

import database as db

_q = queue.Queue(maxsize=200)
_AR = {}
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_ar.json"), encoding="utf-8") as f:
        _AR = json.load(f)
except OSError:
    pass


def _api(token, method, payload=None, timeout=10):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _worker():
    while True:
        text = _q.get()
        s = db.get_settings()
        token, chats = s.get("telegram_token"), s.get("telegram_chats") or []
        for c in chats:
            try:
                _api(token, "sendMessage", {"chat_id": c["id"], "text": text, "parse_mode": "HTML", "disable_web_page_preview": True})
            except Exception as e:
                print(f"[telegram] envoi impossible : {e!r}")
        time.sleep(0.5)   # Telegram limite le débit


threading.Thread(target=_worker, daemon=True).start()


def configured(s=None):
    s = s or db.get_settings()
    return bool(s.get("telegram_token") and s.get("telegram_chats"))


def send(text, kind=None):
    s = db.get_settings()
    if not configured(s):
        return False
    if kind and not (s.get("notify") or {}).get(kind, True):
        return False
    try:
        _q.put_nowait(text)
        return True
    except queue.Full:
        return False


def _esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _ar_text(t):
    m = re.match(r"^(.*?) \(([؀-ۿ][^()]*)\)(.*)$", t)
    if m:
        t = m.group(2) + m.group(3)
    for fr, ar in sorted(_AR.items(), key=lambda kv: -len(kv[0])):
        t = t.replace(fr, ar)
    return (t.replace("Risque élevé : ", "خطر مرتفع: ").replace("Conditions favorables détectées", "ظروف ملائمة للمرض")
             .replace("Prévention : ", "الوقاية: ").replace("Conseil : ", "النصيحة: ").replace("Sol : ", "التربة: "))


def _lang():
    return db.get_settings().get("notify_lang", "fr")


# ---------- évènements ----------
def alert(kind, level, title, message):
    icon = "🔴" if level == "danger" else "🟠"
    if _lang() == "ar":
        title, message = _ar_text(title), _ar_text(message)
    send(f"{icon} <b>{_esc(title)}</b>\n{_esc(message)}", "alerts")


def pump_event(started, mode, seconds=None, moisture=None):
    ar = _lang() == "ar"
    m = "—" if moisture is None else f"{moisture:.0f} %"
    if started:
        what = {"auto": ("Arrosage automatique", "سقي تلقائي"), "manuel": ("Arrosage manuel", "سقي يدوي"),
                "programmé": ("Arrosage programmé", "سقي مبرمج")}.get(mode, ("Arrosage", "سقي"))
        mins = f"{round((seconds or 0) / 60)} min"
        text = f"💧 <b>{what[1]}</b> بدأ — {mins}\nرطوبة التربة: {m}" if ar else f"💧 <b>{what[0]}</b> démarré — {mins}\nHumidité du sol : {m}"
    else:
        text = f"✅ انتهى السقي — رطوبة التربة: {m}" if ar else f"✅ Arrosage terminé — humidité du sol : {m}"
    send(text, "pump")


def offline_event(device_id, offline):
    ar = _lang() == "ar"
    if offline:
        text = f"⚠️ <b>الجهاز {device_id} لا يستجيب</b>\nتأكد من الكهرباء والواي فاي." if ar else \
               f"⚠️ <b>Le boîtier {_esc(device_id)} ne répond plus</b>\nVérifiez l'alimentation et le WiFi."
    else:
        text = f"🟢 الجهاز {device_id} متصل من جديد." if ar else f"🟢 Le boîtier {_esc(device_id)} est de nouveau connecté."
    send(text, "offline")


def daily_summary(status):
    r = status.get("latest_reading") or {}
    w = status.get("water_24h") or {}
    s = db.get_settings()
    litres = (w.get("total_s") or 0) / 60 * float(s.get("pump_flow_lpm") or 10)
    risks = [x for x in (status.get("disease") or {}).get("risks", []) if x["level"] != "faible"]
    if _lang() == "ar":
        lines = ["☀️ <b>صباح الخير — ملخص الحقل</b>",
                 f"رطوبة التربة: {r.get('soil_moisture', '—')} %",
                 f"السقي خلال 24 ساعة: {w.get('n', 0)} مرات · {litres:.0f} لتر",
                 f"المطر المتوقع (12 س): {(status.get('weather') or {}).get('rain_next_12h_mm', 0)} مم"]
        lines += [f"⚠️ {_ar_text(x['label'])}: {x['risk']:.0f} %" for x in risks] or ["✅ لا توجد مخاطر أمراض تذكر."]
    else:
        lines = ["☀️ <b>Bonjour — résumé de la parcelle</b>",
                 f"Humidité du sol : {r.get('soil_moisture', '—')} %",
                 f"Arrosages sur 24 h : {w.get('n', 0)} · {litres:.0f} L",
                 f"Pluie prévue (12 h) : {(status.get('weather') or {}).get('rain_next_12h_mm', 0)} mm"]
        lines += [f"⚠️ {_esc(x['label'])} : {x['risk']:.0f} %" for x in risks] or ["✅ Aucun risque de maladie notable."]
    send("\n".join(lines), "daily")


# ---------- configuration ----------
def detect_chats(token):
    """Lit les derniers messages reçus par le bot pour trouver les personnes qui lui ont écrit /start."""
    data = _api(token, "getUpdates", {"timeout": 0})
    found = {}
    for u in data.get("result", []):
        msg = u.get("message") or u.get("edited_message") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            found[chat["id"]] = chat.get("first_name") or chat.get("title") or chat.get("username") or str(chat["id"])
    return [{"id": k, "name": v} for k, v in found.items()]


def bot_name(token):
    return _api(token, "getMe").get("result", {}).get("username")


def test():
    ok = send("✅ Sāqiya : les alertes arrivent bien sur ce téléphone." if _lang() != "ar" else "✅ الساقية: التنبيهات تصل إلى هذا الهاتف.")
    return ok
