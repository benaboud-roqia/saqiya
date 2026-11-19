"""Analyse de la fertilité du sol (pH, salinité EC, N-P-K) et conseils de fertilisation."""
import database as db
import knowledge


def analyze(reading, settings, create_alerts=True):
    if not reading:
        return []
    crop = knowledge.crop(settings["crop"])
    KB = knowledge.KB
    advice = []

    ph = reading.get("soil_ph")
    if ph is not None:
        lo, hi = crop["ph"]
        if ph < lo:
            advice.append({"param": "pH", "status": "bas", "value": ph,
                           "message": f"Sol trop acide (pH {ph:.1f} < {lo}) : les éléments nutritifs sont moins disponibles.",
                           "action": "Chaulage (calcaire broyé ou dolomie), à ajuster selon une analyse de sol."})
        elif ph > hi:
            advice.append({"param": "pH", "status": "haut", "value": ph,
                           "message": f"Sol trop alcalin (pH {ph:.1f} > {hi}) : risque de chlorose ferrique.",
                           "action": "Engrais acidifiants (sulfate d'ammonium), soufre élémentaire, matière organique ; chélates de fer si chlorose."})
        else:
            advice.append({"param": "pH", "status": "ok", "value": ph,
                           "message": f"pH {ph:.1f} adapté à la culture ({lo}–{hi}).", "action": None})

    ec = reading.get("soil_ec")
    if ec is not None:
        if ec > crop["ec_max"]:
            advice.append({"param": "EC", "status": "haut", "value": ec,
                           "message": f"Salinité élevée (EC {ec:.2f} dS/m > {crop['ec_max']}) : stress pour la plante.",
                           "action": "Irrigation de lessivage avec une eau peu salée, éviter le chlorure de potassium, améliorer le drainage."})
        else:
            advice.append({"param": "EC", "status": "ok", "value": ec,
                           "message": f"Salinité acceptable (EC {ec:.2f} dS/m).", "action": None})

    for key, field in (("N", "n"), ("P", "p"), ("K", "k")):
        v = reading.get(field)
        if v is None:
            continue
        ref = KB["nutrients"][key]
        if v < ref["low"]:
            advice.append({"param": key, "status": "bas", "value": v,
                           "message": f"{key} faible ({v:.0f} {ref['unit']} < {ref['low']}) — rôle : {ref['role']}.",
                           "action": ref["fertilizer_low"]})
        elif v > ref["high"]:
            advice.append({"param": key, "status": "haut", "value": v,
                           "message": f"{key} élevé ({v:.0f} {ref['unit']}).", "action": ref["excess"]})
        else:
            advice.append({"param": key, "status": "ok", "value": v,
                           "message": f"{key} correct ({v:.0f} {ref['unit']}).", "action": None})

    if create_alerts:
        for a in advice:
            if a["status"] != "ok":
                db.add_alert("sol", "warning", f"Sol : {a['param']} {a['status']}",
                             f"{a['message']} Conseil : {a['action']}", dedupe_seconds=24 * 3600)
    return advice
