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
def _has(q, words):
    return any(w in q for w in words)


def _local_answer(question, ctx):
    q = question.lower()
    r = ctx.get("latest_reading") or {}
    dec = ctx.get("irrigation_decision") or {}
    th = ctx.get("thresholds") or {}
    w = ctx.get("weather") or {}
    lines = []

    if _has(q, ["سق", "الري", "arros", "irrig", " eau", "ماء", "pomp", "مضخ"]):
        m = r.get("soil_moisture")
        if m is None:
            lines.append("Je n'ai pas encore de mesure d'humidité du sol.")
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

    if _has(q, ["مرض", "أمراض", "malad", "champign", "فطر", "mildiou", "oïdium", "oidium"]):
        risks = (ctx.get("disease") or {}).get("risks", [])
        if risks:
            lines.append("Risques de maladies actuels :")
            lines += [f"• {x['label']} : {x['risk']} % ({x['level']}) — {x['prevention']}" for x in risks[:3]]

    if not lines:
        lines.append("Je suis le خبير فلاحي du système. Posez-moi des questions sur l'arrosage, "
                     "les maladies, les engrais ou le jaunissement des feuilles.")
        if r:
            lines.append(f"État actuel : sol {r.get('soil_moisture')} %, air {r.get('air_temp')} °C / "
                         f"{r.get('air_humidity')} %.")
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
