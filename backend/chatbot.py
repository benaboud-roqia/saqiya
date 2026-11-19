"""Chatbot agricole intelligent « الخبير الفلاحي » (section 3.3 du cahier des charges).

Combine :
  - les données en direct des capteurs (état du champ),
  - la base de connaissances agricole (cultures, maladies, engrais),
  - un modèle de langage (Claude, via le SDK officiel Anthropic).

Sans clé API (variable d'environnement ANTHROPIC_API_KEY), un moteur de réponses local
basé sur des règles répond quand même aux questions courantes à partir des données du champ.
"""
import json
import os
import re

import database as db
import knowledge
import llm

MODEL = os.environ.get("SMARTFARM_MODEL", "claude-opus-5-5")

try:
    import anthropic
except ImportError:  # SDK non installé -> mode local uniquement
    anthropic = None

_client = None

SYSTEM_PROMPT = """Tu es « الخبير الفلاحي » (Flash Expert), l'assistant agronome d'un système d'irrigation \
intelligent basé sur l'IoT. Tu parles à un agriculteur, souvent non spécialiste.

Règles :
- Réponds dans la langue de la question (arabe standard, darija algérienne ou français). Tu aides des agriculteurs algériens.
- Base tes réponses sur les DONNÉES DU CHAMP fournies avec chaque question (capteurs en direct, météo,
  décision d'irrigation, risques de maladies, analyse du sol). Cite les valeurs utiles.
- Donne des conseils concrets et courts : quoi faire, quand, combien. Évite le jargon.
- Si une information manque (capteur absent, météo indisponible), dis-le et donne un conseil prudent.
- Pour les produits phytosanitaires, rappelle de respecter l'étiquette, les doses et le délai avant récolte,
  et de consulter un technicien agricole local en cas de doute.
- FORMAT : texte simple uniquement, comme un SMS bien écrit. N'utilise JAMAIS de Markdown : pas d'astérisques (*),
  pas de dièses (#), pas de tirets bas (_), pas d'accents graves (`), pas de tableaux ni de liens. Pour une liste,
  mets chaque point sur une nouvelle ligne commençant par « • ». Phrases courtes, paragraphes séparés par une ligne vide.

BASE DE CONNAISSANCES AGRICOLE (JSON) :
""" + json.dumps(knowledge.KB, ensure_ascii=False)


_client_key = None


def _settings_key():
    return db.get_settings().get("anthropic_api_key") or ""


def _get_client():
    """Client Claude : clé de l'environnement, sinon clé saisie dans Réglages › IA."""
    global _client, _client_key
    if anthropic is None:
        return None
    key = os.environ.get("ANTHROPIC_API_KEY") or _settings_key()
    if _client is None or key != _client_key:
        try:
            _client = anthropic.Anthropic(api_key=key) if key else anthropic.Anthropic()
            _client_key = key
        except Exception:
            return None
    return _client


def llm_available():
    return llm.available()


def _ask_groq(question, context):
    history = [h for h in db.chat_history(12) if h["role"] in ("user", "assistant")]
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": "DONNÉES DU CHAMP (temps réel) :\n"
                     + json.dumps(context, ensure_ascii=False, default=str)
                     + "\n\nQUESTION DE L'AGRICULTEUR :\n" + question})
    text, _ = llm.groq_chat(messages, max_tokens=1500)
    return text or None


def _ask_claude(question, context):
    client = _get_client()
    if client is None:
        return None
    history = [h for h in db.chat_history(12) if h["role"] in ("user", "assistant")]
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    # l'API exige que la conversation commence par un message utilisateur
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    messages.append({
        "role": "user",
        "content": "DONNÉES DU CHAMP (temps réel) :\n"
                   + json.dumps(context, ensure_ascii=False, default=str)
                   + "\n\nQUESTION DE L'AGRICULTEUR :\n" + question,
    })
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
        output_config={"effort": "low"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        return "Je ne peux pas répondre à cette question. Reformulez-la ou contactez un technicien agricole."
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text or None


# ---------------------------------------------------------------- moteur local
import difflib  # noqa: E402
import unicodedata  # noqa: E402

try:
    with open(os.path.join(os.path.dirname(__file__), "crop_diseases.json"), encoding="utf-8") as _f:
        CROP_DISEASES = {k: v for k, v in json.load(_f).items() if not k.startswith("_")}
except (OSError, ValueError):
    CROP_DISEASES = {}

# noms des cultures tels que l'agriculteur les écrit (français, arabe, darija)
CROP_WORDS = {
    "pomme_de_terre": ["pomme de terre", "pommes de terre", "patate", "batata", "بطاطا", "بطاطس", "البطاطا"],
    "tomate": ["tomate", "tomates", "طماطم", "طماطيش", "الطماطم"],
    "ble": ["ble", "blé", "قمح", "القمح"],
    "olivier": ["olivier", "olive", "زيتون", "الزيتون"],
    "agrumes": ["agrume", "orange", "citron", "حمضيات", "برتقال", "ليمون"],
    "poivron": ["poivron", "piment", "فلفل", "الفلفل"],
    "fraise": ["fraise", "فراولة", "الفراولة"],
    "vigne": ["vigne", "raisin", "عنب", "العنب", "كرمة"],
}


def _norm(s):
    """minuscules, sans accents, ponctuation remplacée par des espaces (garde l'arabe)."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^\w؀-ۿ]+", " ", s).strip()


def _has(q, words):
    """vrai si un des mots-clés est dans la question, même avec une petite faute de frappe."""
    tokens = q.split()
    words = [_norm(w) for w in words if _norm(w)]
    for w in words:
        if (w in tokens) if len(w) <= 3 else (w in q):   # mots courts (« eau », « ph ») : mot entier seulement
            return True
    for w in words:
        if len(w) >= 5 and " " not in w and difflib.get_close_matches(w, tokens, n=1, cutoff=0.78):
            return True
        # préfixes tapés de travers : « ;aladie » → « aladie » ≈ « maladie »
        if len(w) >= 6 and any(len(t) >= 5 and difflib.SequenceMatcher(None, w, t[:len(w)]).ratio() >= 0.8 for t in tokens):
            return True
    return False


def _crop_in(q, ctx):
    for key, words in CROP_WORDS.items():
        if _has(q, [_norm(w) for w in words]):
            return key
    return ctx.get("culture")


def _crop_label(key):
    return (knowledge.KB["crops"].get(key) or {}).get("label", key or "votre culture")


def _local_answer(question, ctx):
    q = _norm(question)
    r = ctx.get("latest_reading") or {}
    dec = ctx.get("irrigation_decision") or {}
    th = ctx.get("thresholds") or {}
    w = ctx.get("weather") or {}
    lines = []
    crop = _crop_in(q, ctx)

    if _has(q, ["salut", "bonjour", "bonsoir", "salam", "slm", "hello", "coucou", "السلام", "سلام", "مرحبا", "اهلا", "صباح", "مساء"]) and len(q.split()) <= 4:
        lines.append("وعليكم السلام ! Bonjour, je suis votre conseiller agricole.")
        lines.append("Demandez-moi par exemple : « Est-ce que je dois arroser ? », « Quelles maladies menacent la "
                     f"{_crop_label(crop).split(' (')[0].lower()} ? », « Quel engrais mettre ? » ou « Pourquoi les feuilles jaunissent ? ».")

    if _has(q, ["merci", "شكرا", "شكرًا", "barak", "saha", "يعطيك"]) and len(q.split()) <= 5:
        lines.append("Avec plaisir ! Je reste disponible pour toute question sur votre parcelle.")

    if _has(q, ["سق", "الري", "ري ", "arros", "irrig", "eau", "ماء", "الماء", "pomp", "مضخ", "goutte"]):
        m = r.get("soil_moisture")
        if m is None:
            lines.append("Je n'ai pas encore de mesure d'humidité du sol : le boîtier n'envoie rien pour l'instant.")
            if w.get("available"):
                lines.append(f"Pluie prévue sur 12 h : {w.get('rain_next_12h_mm', 0)} mm (probabilité max {w.get('rain_prob_max_12h', 0)} %). "
                             + ("Inutile d'arroser avant la pluie." if (w.get("rain_prob_max_12h") or 0) >= 60 else "Pas de pluie importante annoncée."))
            lines.append("En attendant : enfoncez un doigt à 5 cm dans le sol. S'il est sec, arrosez tôt le matin ; s'il est frais et humide, attendez.")
            lines.append("Branchez l'ESP32 au PC en USB pour que je décide avec la vraie humidité du sol.")
        else:
            lines.append(f"Humidité du sol actuelle : {m:.1f} % (seuil {th.get('threshold')} %, "
                         f"cible {th.get('target')} %).")
            if w.get("available"):
                lines.append(f"Pluie prévue sur 12 h : {w.get('rain_next_12h_mm', 0)} mm "
                             f"(probabilité max {w.get('rain_prob_max_12h', 0)} %).")
            lines.append(f"Décision du système : {dec.get('action', '—')} — {dec.get('reason', '')}")
            if m < (th.get("threshold") or 0):
                lines.append("Réponse : oui, le sol est sec, il faut arroser (sauf si la pluie est prévue).")
            else:
                lines.append("Réponse : non, pas besoin d'arroser maintenant, le sol est assez humide.")

    if _has(q, ["أصفر", "اصفر", "صفراء", "jaun", "yellow", "صفر"]):
        lines.append("Causes possibles du jaunissement des feuilles :")
        lines += [f"• {c}" for c in knowledge.KB["yellow_leaves"]]
        hints = [a["message"] for a in ctx.get("soil_advice", []) if a["status"] != "ok"]
        if hints:
            lines.append("D'après vos capteurs : " + " ".join(hints))

    if _has(q, ["سماد", "اسمد", "أسمد", "engrais", "fertili", "npk", "azote", "نيتروجين"]):
        bad = [a for a in ctx.get("soil_advice", []) if a["status"] != "ok"]
        if bad:
            lines.append("Recommandations de fertilisation selon vos capteurs :")
            lines += [f"• {a['message']} → {a['action']}" for a in bad]
        else:
            lines.append("Les niveaux N-P-K, pH et salinité mesurés sont corrects : "
                         "un engrais d'entretien équilibré suffit. " + (ctx.get("crop") or {}).get("needs", ""))

    # une maladie précise est nommée : fiche détaillée
    named = []
    for key, items in CROP_DISEASES.items():
        for d in items:
            base = _norm(d["name"].split("(")[0])
            main = base.split()[0] if base else ""
            if main and len(main) >= 5 and _has(q, [main]) and d["name"] not in [x["name"] for x in named]:
                named.append(d)
    disease_q = _has(q, ["مرض", "امراض", "أمراض", "الامراض", "maladie", "maladies", "malad", "champign", "فطر", "virus",
                         "ravageur", "insecte", "حشرة", "parasite", "tache", "taches", "بقع", "pourri", "عفن"])
    if named and not disease_q:
        for d in named[:2]:
            lines.append(f"{d['name']}")
            lines.append(f"• Comment la reconnaître : {d['spot']}.")
            lines.append(f"• Que faire : {d['act']}.")
    elif disease_q or named:
        items = CROP_DISEASES.get(crop) or []
        label = _crop_label(crop).split(" (")[0].lower()
        if items:
            lines.append(f"Principales maladies et ravageurs de la {label} :")
            for d in items:
                lines.append(f"• {d['name']} : {d['spot']}. À faire : {d['act']}.")
        risks = (ctx.get("disease") or {}).get("risks", [])
        if risks and crop == ctx.get("culture"):
            top = [x for x in risks if x.get("level") != "faible"]
            lines.append("")
            if top:
                lines.append("Risque en ce moment d'après les mesures de votre parcelle :")
                lines += [f"• {x['label']} : {x['risk']} % ({x['level']}). {x['prevention']}" for x in top[:3]]
            else:
                lines.append("En ce moment, les mesures de votre parcelle ne montrent aucun risque élevé de maladie.")
        elif not r:
            lines.append("")
            lines.append("Branchez le boîtier pour que je calcule le risque réel sur votre parcelle.")
        lines.append("Confirmez avec un technicien agricole avant tout traitement et respectez l'étiquette des produits.")

    if _has(q, ["meteo", "météo", "pluie", "pleuvoir", "temps", "طقس", "مطر", "الجو", "chaleur", "حرارة"]) and not lines:
        if w.get("available"):
            c = w.get("current") or {}
            lines.append(f"Météo à la parcelle : {c.get('temperature_2m', '—')} °C, humidité de l'air {c.get('relative_humidity_2m', '—')} %.")
            lines.append(f"Pluie prévue sur 12 h : {w.get('rain_next_12h_mm', 0)} mm (probabilité max {w.get('rain_prob_max_12h', 0)} %).")
        else:
            lines.append("La météo n'est pas disponible pour le moment (pas de connexion Internet).")

    if _has(q, ["capteur", "boitier", "boîtier", "mesure", "mesures", "etat", "état", "sol", "ph", "salinite", "مستشعر", "قياس", "التربة"]) and not lines:
        if r:
            lines.append(f"Dernières mesures : humidité du sol {r.get('soil_moisture')} %, température du sol {r.get('soil_temp')} °C, "
                         f"pH {r.get('soil_ph')}, salinité {r.get('soil_ec')} dS/m, N {r.get('n')} · P {r.get('p')} · K {r.get('k')} mg/kg.")
        else:
            lines.append("Aucun boîtier n'envoie de mesures pour l'instant : branchez l'ESP32 au PC en USB (moniteur série fermé).")

    if not lines:
        lines.append("Je n'ai pas bien compris la question, mais je peux vous aider sur :")
        lines.append("• l'arrosage (« Est-ce que je dois arroser ? »)")
        lines.append(f"• les maladies (« Quelles maladies menacent la {_crop_label(crop).split(' (')[0].lower()} ? »)")
        lines.append("• les engrais et le jaunissement des feuilles")
        lines.append("• la météo et les mesures du boîtier")
        if r:
            lines.append(f"État actuel : sol {r.get('soil_moisture')} %, air {r.get('air_temp')} °C / {r.get('air_humidity')} %.")
    return "\n".join(lines)


def plain_text(text):
    """Retire toute mise en forme Markdown d'une réponse : l'agriculteur lit du texte simple."""
    if not text:
        return text
    t = text.replace("\r\n", "\n")
    t = re.sub(r"```[a-zA-Z]*\n?(.*?)```", r"\1", t, flags=re.S)          # blocs de code
    t = re.sub(r"`([^`]*)`", r"\1", t)                                     # code en ligne
    t = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", t)                        # images
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1 (\2)", t)         # liens
    lines = []
    for ln in t.split("\n"):
        s = ln.strip()
        if re.fullmatch(r"\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?", s):  # ligne de séparation d'un tableau
            continue
        if s.startswith("|") and s.endswith("|"):                          # ligne de tableau -> valeurs séparées
            s = "   ".join(c.strip() for c in s.strip("|").split("|"))
        s = re.sub(r"^#{1,6}\s*", "", s)                                   # titres
        s = re.sub(r"^>\s?", "", s)                                        # citations
        s = re.sub(r"^[*+\-]\s+", "• ", s)                                 # puces
        if re.fullmatch(r"[-*_=]{3,}", s):                                 # traits horizontaux
            continue
        lines.append(s)
    t = "\n".join(lines)
    t = re.sub(r"(?<=\d)\s*\*\s*(?=\d)", " × ", t)                        # 3*4 -> 3 × 4 (multiplication)
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)                             # gras
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", t)    # italique *x*
    t = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"\1", t)      # italique _x_
    t = t.replace("*", "").replace("#", "").replace("`", "")              # restes éventuels
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def answer(question, context):
    reply, source = None, "local"
    if llm_available():
        try:
            if llm.provider() == "groq":
                reply = _ask_groq(question, context)
            else:
                reply = _ask_claude(question, context)
            source = "claude"
        except llm.AIError as e:
            print(f"[chatbot] IA indisponible : {e}")
            reply = f"(Conseiller complet indisponible : {str(e).rstrip('.').lower()}.)\n\n" + _local_answer(question, context)
            source = "local"
        except Exception as e:
            reason = "clé API invalide" if anthropic and isinstance(e, anthropic.AuthenticationError) else \
                     "limite d'utilisation atteinte" if anthropic and isinstance(e, anthropic.RateLimitError) else \
                     "connexion impossible" if anthropic and isinstance(e, anthropic.APIConnectionError) else \
                     f"erreur API ({type(e).__name__})"
            print(f"[chatbot] Claude indisponible : {e!r}")
            reply = f"(Conseiller complet indisponible : {reason}.)\n\n" + _local_answer(question, context)
            source = "local"
    if not reply:
        reply = _local_answer(question, context)
        source = "local"
    reply = plain_text(reply)
    db.add_chat("user", question, "user")
    db.add_chat("assistant", reply, source)
    return {"reply": reply, "source": source}
