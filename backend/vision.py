"""Diagnostic des photos par intelligence artificielle (vision de Claude).

Chaque photo de feuille, fruit ou parcelle est examinée : plante reconnue, état (sain / malade / stress),
maladies probables avec un taux de confiance, symptômes observés et conseils, en français et en arabe.
Le contexte réel du champ (culture, humidité, météo, risques calculés par les capteurs) est fourni au modèle.
"""
import base64
import json
import os

import database as db
import knowledge

MODEL = os.environ.get("SMARTFARM_MODEL", "claude-opus-5-5")

try:
    import anthropic
except ImportError:
    anthropic = None

SCHEMA = {
    "type": "object",
    "properties": {
        "is_plant": {"type": "boolean"},
        "plant": {"type": "string"},
        "status": {"type": "string", "enum": ["sain", "malade", "stress", "inconnu"]},
        "urgency": {"type": "string", "enum": ["aucune", "faible", "moyenne", "haute"]},
        "summary_fr": {"type": "string"},
        "summary_ar": {"type": "string"},
        "diagnoses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name_fr": {"type": "string"},
                    "name_ar": {"type": "string"},
                    "confidence": {"type": "integer"},
                    "evidence_fr": {"type": "string"},
                    "evidence_ar": {"type": "string"},
                },
                "required": ["name_fr", "name_ar", "confidence", "evidence_fr", "evidence_ar"],
                "additionalProperties": False,
            },
        },
        "advice_fr": {"type": "array", "items": {"type": "string"}},
        "advice_ar": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_plant", "plant", "status", "urgency", "summary_fr", "summary_ar", "diagnoses", "advice_fr", "advice_ar"],
    "additionalProperties": False,
}

SYSTEM = """Tu es un phytopathologiste qui examine des photos envoyées par des agriculteurs algériens.
Règles :
- Décris seulement ce que tu vois réellement sur la photo. Si l'image est floue, trop sombre, trop lointaine
  ou ne montre pas de plante, dis-le (is_plant=false ou status="inconnu") au lieu de deviner.
- Donne au plus 3 diagnostics, du plus probable au moins probable, avec une confiance de 0 à 100
  honnête (une photo seule ne permet presque jamais plus de 85).
- Utilise le contexte du champ fourni (culture déclarée, humidité, météo, risques calculés par les capteurs)
  pour départager les hypothèses, sans le laisser contredire ce qui est visible.
- Conseils concrets et courts (3 à 5), adaptés à l'Algérie ; pour les produits phytosanitaires, rappeler de
  respecter l'étiquette et de consulter un technicien agricole en cas de doute.
- Rédige chaque texte en français (champs _fr) et en arabe simple (champs _ar).
- urgency : "haute" si la récolte risque d'être perdue sans action rapide, "aucune" si la plante est saine."""


import llm  # noqa: E402

JSON_SHAPE = """Réponds UNIQUEMENT par un objet JSON (sans texte autour) de cette forme exacte :
{"is_plant": true, "plant": "nom de la plante en français", "status": "sain|malade|stress|inconnu",
 "urgency": "aucune|faible|moyenne|haute", "summary_fr": "2 phrases", "summary_ar": "جملتان",
 "diagnoses": [{"name_fr": "...", "name_ar": "...", "confidence": 0-100, "evidence_fr": "symptômes vus", "evidence_ar": "..."}],
 "advice_fr": ["conseil 1", "..."], "advice_ar": ["نصيحة 1", "..."]}"""


def api_key():
    return llm.claude_key()


def available():
    return llm.available()


def _normalize(r):
    out = {
        "is_plant": bool(r.get("is_plant", True)),
        "plant": str(r.get("plant") or ""),
        "status": r.get("status") if r.get("status") in ("sain", "malade", "stress", "inconnu") else "inconnu",
        "urgency": r.get("urgency") if r.get("urgency") in ("aucune", "faible", "moyenne", "haute") else "faible",
        "summary_fr": str(r.get("summary_fr") or ""), "summary_ar": str(r.get("summary_ar") or ""),
        "advice_fr": [str(x) for x in (r.get("advice_fr") or [])][:5],
        "advice_ar": [str(x) for x in (r.get("advice_ar") or [])][:5],
        "diagnoses": [],
    }
    for d in (r.get("diagnoses") or [])[:3]:
        if not isinstance(d, dict):
            continue
        try:
            conf = int(float(d.get("confidence", 0)))
        except (TypeError, ValueError):
            conf = 0
        out["diagnoses"].append({k: str(d.get(k) or "") for k in ("name_fr", "name_ar", "evidence_fr", "evidence_ar")}
                                | {"confidence": max(0, min(100, conf))})
    out["diagnoses"].sort(key=lambda d: -d["confidence"])
    return out


def _analyze_groq(photo, data, media, prompt_text):
    text, model = llm.groq_chat([
        {"role": "system", "content": SYSTEM + "\n\n" + JSON_SHAPE},
        {"role": "user", "content": [
            {"type": "text", "text": prompt_text},
            {"type": "image_url", "image_url": {"url": f"data:{media};base64,{data}"}},
        ]},
    ], json_mode=True, vision=True)
    try:
        raw = json.loads(text[text.index("{"): text.rindex("}") + 1])
    except ValueError:
        raise llm.AIError("Réponse de l'IA illisible : relancez le diagnostic.")
    result = _normalize(raw)
    result["model"] = f"Groq · {model}"
    return result


def analyze(photo, context):
    """Renvoie le diagnostic (dict) d'une photo enregistrée dans data/photos."""
    if not available():
        raise llm.AIError("Clé d'IA absente : ajoutez une clé Groq dans Réglages › IA.")
    if llm.provider() == "groq":
        path = os.path.join(db.PHOTOS_DIR, photo["file"])
        ext = os.path.splitext(path)[1].lower()
        media = {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
        with open(path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode()
        crop = knowledge.crop(db.get_settings()["crop"])
        note = (photo.get("caption") or "").strip()
        prompt = (f"Catégorie de la photo : {photo.get('kind')}.\nCulture déclarée de la parcelle : {crop['label']}.\n"
                  + (f"Note de l'agriculteur : {note}\n" if note else "")
                  + "Contexte du champ (capteurs, météo, risques calculés) :\n" + json.dumps(context, ensure_ascii=False, default=str))
        return _analyze_groq(photo, data, media, prompt)
    if anthropic is None:
        raise llm.AIError("Le paquet anthropic n'est pas installé.")
    path = os.path.join(db.PHOTOS_DIR, photo["file"])
    ext = os.path.splitext(path)[1].lower()
    media = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode()
    settings = db.get_settings()
    crop = knowledge.crop(settings["crop"])
    note = (photo.get("caption") or "").strip()
    client = anthropic.Anthropic(api_key=api_key())
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media, "data": data}},
                {"type": "text", "text":
                    f"Catégorie de la photo : {photo.get('kind')}.\n"
                    f"Culture déclarée de la parcelle : {crop['label']}.\n"
                    + (f"Note de l'agriculteur : {note}\n" if note else "")
                    + "Contexte du champ (capteurs, météo, risques calculés) :\n"
                    + json.dumps(context, ensure_ascii=False, default=str)},
            ],
        }],
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("L'analyse de cette photo a été refusée. Essayez une autre photo.")
    text = next(b.text for b in response.content if b.type == "text")
    result = json.loads(text)
    result["diagnoses"] = sorted(result.get("diagnoses", []), key=lambda d: -d.get("confidence", 0))[:3]
    for d in result["diagnoses"]:
        d["confidence"] = max(0, min(100, int(d.get("confidence", 0))))
    result["model"] = response.model
    return result
