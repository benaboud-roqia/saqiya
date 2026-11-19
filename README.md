# Système d'irrigation intelligent — IoT + IA
### نظام ذكي للري الزراعي باستخدام إنترنت الأشياء والذكاء الاصطناعي

Implémentation complète du cahier des charges « مشروع زراعة الذكية » :
un boîtier IoT collecte les données du sol, de l'air et de la météo ; un serveur backend
les stocke, les analyse et assure trois fonctions :

1. **Irrigation automatique** (الري الأوتوماتيكي)
2. **Prédiction des maladies des plantes** (التنبؤ بأمراض النباتات)
3. **Chatbot agricole intelligent « الخبير الفلاحي »** (Flash Expert)

---

## 1. Architecture

```
┌──────────────────────────┐   HTTP/JSON (WiFi)   ┌─────────────────────────────────────────┐
│  Boîtier IoT (ESP32)     │ ───────────────────▶ │  Backend Python  (backend/server.py)    │
│  • Humidité du sol       │   POST /api/readings │  • SQLite : mesures, arrosages, alertes │
│  • Température du sol    │                      │  • irrigation.py : règles + apprentissage│
│  • pH, salinité (EC)     │ ◀─────────────────── │  • disease.py  : IA bayésienne          │
│  • NPK (RS485)           │   {"pump": true/false│  • soil.py     : fertilité / engrais    │
│  • T° / humidité de l'air│    "seconds_remaining"}│ • weather.py  : prévisions Open-Meteo  │
│  • Capteur de pluie      │                      │  • chatbot.py  : Claude + base agricole │
│  • Relais → pompe        │                      └──────────────┬──────────────────────────┘
└──────────────────────────┘                                     │ API REST
   (ou simulator/simulator.py)                                   ▼
                                                   Tableau de bord web (dashboard/)
                                                   http://localhost:8000
```

| Couche | Fichiers |
|---|---|
| Perception (IoT) | `firmware/esp32_smart_irrigation/esp32_smart_irrigation.ino`, `simulator/simulator.py` |
| Stockage | `backend/database.py` → `data/smartfarm.db` (SQLite) |
| Intelligence | `backend/irrigation.py`, `backend/disease.py`, `backend/soil.py`, `backend/chatbot.py` |
| Connaissances | `backend/knowledge_base.json` (cultures, sols, maladies, engrais) |
| Interface | `dashboard/index.html`, `app.js`, `style.css` |

---

## 2. Démarrage rapide (sans matériel)

Prérequis : **Python 3.10 ou plus récent**. Aucune autre installation n'est obligatoire.

**Windows** : double-cliquez sur `demarrer.bat` (ouvre le serveur, le simulateur et le navigateur).

Ou manuellement, dans deux terminaux :

```bash
python backend/server.py
```

```bash
python simulator/simulator.py
```

Puis ouvrez :

| Adresse | Contenu |
|---|---|
| **http://localhost:8000** | Site de présentation du projet (dossier `site/`) |
| **http://localhost:8000/app/** | Tableau de bord (dossier `dashboard/`) |

### Comptes et connexion

Le tableau de bord est protégé : **http://localhost:8000/login**.

- Le **premier compte créé devient propriétaire** et entre directement.
- Toute nouvelle inscription reste **en attente** : la personne n'entre qu'après que le propriétaire a
  **ouvert son compte** (Paramètres › Comptes). La page d'attente s'ouvre toute seule dès la validation.
- Connexion par **e-mail + mot de passe** (chiffré avec scrypt) ou **avec Google / Gmail**. Pour activer Google,
  créez un « ID client OAuth » (Application Web, origine `http://localhost:8000`) sur console.cloud.google.com
  et collez-le dans Paramètres › Comptes. Google n'accepte que `localhost` ou une adresse https : depuis un
  téléphone sur le WiFi, utilisez l'e-mail.
- Le site de présentation reste public ; le boîtier ESP32 continue d'envoyer ses mesures avec sa clé.

Le site affiche l'état réel de la parcelle dans son en-tête et intègre le tableau de bord en direct.
Ses photos viennent d'Unsplash (licence Unsplash, usage libre) et sont chargées depuis Internet ; les liens
vers chaque photo sont dans le pied de page.

Options du simulateur :

```bash
python simulator/simulator.py --scenario humide   # nuits humides → alerte mildiou
python simulator/simulator.py --scenario sec      # forte chaleur → arrosages fréquents
python simulator/simulator.py --speed 600         # temps accéléré (1 s réelle = 10 min simulées)
```

Pour que les graphiques de la vue **Analyses** soient remplis dès la première démonstration,
générez une semaine d'historique (une seule fois) :

```bash
python simulator/generer_historique.py
```

### Le tableau de bord « Sāqiya »

| Vue | Contenu |
|---|---|
| **Parcelle** | Scène animée pilotée par les données (ciel selon l'heure, soleil/lune, nuages selon la probabilité de pluie, pluie, couleur du sol selon l'humidité, plantes qui flétrissent quand le sol est sec, eau qui circule dans le goutte-à-goutte quand la pompe tourne), jauge d'humidité, commande de la pompe, prévisions 12 h, relevés avec mini-courbes, graphique interactif, maladies, fertilité, alertes |
| **Analyses** | Indicateurs 7 jours, eau consommée par jour (litres), humidité du sol min/max/moyenne, carte de chaleur de l'humidité de l'air heure par heure, radar des risques de maladies, écarts de température, évolution N-P-K |
| **Photos** | Photos de la parcelle, des feuilles, des fruits, du sol (appareil photo du téléphone), filtres, visionneuse plein écran |
| **Conseiller** | Chatbot « الخبير الفلاحي » |
| **Journal** | Historique des arrosages |
| **Réglages** | Culture, sol, position, seuils, débit de la pompe, clé du boîtier |

Les photos sont enregistrées dans `data/photos/`.

### Activer le chatbot complet (Claude)

Sans clé, le chatbot répond en **mode local** (règles + données du champ). Pour un vrai dialogue
en langage naturel (arabe, darija, français) :

```bash
pip install anthropic
```

puis définissez la clé avant de lancer le serveur (PowerShell) :

```powershell
$env:ANTHROPIC_API_KEY = "votre-clé"
python backend/server.py
```

Le modèle utilisé est `claude-opus-5-5` (modifiable via la variable `SMARTFARM_MODEL`).

---

## 3. Fonctionnement détaillé

### 3.1 Irrigation automatique (`backend/irrigation.py`)

Données utilisées : humidité du sol, température et humidité de l'air, météo, type de sol (enregistré).

**Règles (étape 1 du cahier des charges)** — à chaque mesure :

1. Seuil et cible d'humidité calculés selon le **type de sol** (sableux 20 %, limoneux 30 %, argileux 38 %…)
   et la **culture** (ex. olivier −8 %, fraise +5 %). Cible +3 % s'il fait > 32 °C et air sec.
2. Si humidité < seuil :
   - pluie détectée par le capteur → **annulé** ;
   - pluie prévue ≥ 3 mm ou probabilité ≥ 70 % dans les 12 h (Open-Meteo) → **reporté** (économie d'eau) ;
   - dernier arrosage il y a moins de 60 min → **reporté** (laisser l'eau diffuser) ;
   - sinon **démarrage de la pompe** pour une durée = (cible − humidité) × secondes par %.
3. Arrêt quand la cible est atteinte, quand la durée est écoulée ou s'il se met à pleuvoir.

**Apprentissage (étape 2)** — après chaque arrosage, le système compare l'humidité avant/après et
ajuste automatiquement le paramètre « secondes de pompe pour +1 % » (moyenne glissante). La durée
d'arrosage devient donc de plus en plus juste pour **votre** parcelle et **votre** pompe.
Une **régression linéaire** sur la vitesse de séchage du sol prédit l'heure du prochain arrosage.

Sécurité : durée maximale par arrosage (900 s par défaut) ; le boîtier ESP32 coupe lui-même la pompe
à l'échéance même si le serveur ne répond plus.

### 3.2 Prédiction des maladies (`backend/disease.py`)

Modèle : **classifieur bayésien naïf gaussien** (codé en Python pur) entraîné sur
`data/disease_dataset.csv`. Variables : température et humidité moyennes sur 6 h, heures
d'humectation du feuillage (HR ≥ 90 %) sur 24 h, excès d'humidité du sol.

Maladies couvertes : mildiou, oïdium, botrytis (pourriture grise), rouille, pourriture des racines —
filtrées selon la sensibilité de la culture choisie. Un risque ≥ 60 % crée une **alerte préventive**
avec les mesures de prévention et de traitement.

> ⚠️ Le jeu de données fourni est **synthétique** (généré à partir des conditions épidémiologiques
> connues de chaque maladie). Pour un modèle plus fiable, remplacez `data/disease_dataset.csv` par des
> observations de terrain réelles (mêmes colonnes : `temp, rh, wet_hours, soil_excess, label`) puis
> redémarrez le serveur.

### 3.3 Chatbot « الخبير الفلاحي » (`backend/chatbot.py`)

À chaque question, le chatbot reçoit : les mesures en direct, la décision d'irrigation, la météo, les
risques de maladies, l'analyse du sol et la base de connaissances agricole. Il répond dans la langue
de l'agriculteur. Exemples : « هل يجب أن أسقي اليوم؟ », « لماذا تتحول أوراق النبات إلى الأصفر؟ »,
« ما نوع السماد الذي يجب استخدامه؟ ».

### Fertilité du sol (`backend/soil.py`)

pH, salinité (EC) et N-P-K sont comparés aux besoins de la culture → conseils d'engrais
(urée, superphosphate, sulfate de potasse, chaulage, lessivage…) et alertes.

---

## 4. Matériel (version réelle)

| Composant | Rôle | Broche ESP32 |
|---|---|---|
| ESP32 DevKit | Microcontrôleur WiFi | — |
| Capteur d'humidité du sol capacitif v1.2 | Humidité du sol | GPIO 34 |
| DS18B20 étanche (+ résistance 4,7 kΩ) | Température du sol | GPIO 4 |
| DHT22 | Température / humidité de l'air | GPIO 15 |
| Sonde pH analogique | pH du sol | GPIO 35 |
| Capteur EC / TDS analogique | Salinité | GPIO 32 |
| Capteur NPK RS485 + module MAX485 | N, P, K | RX2 16, TX2 17, DE/RE 5 |
| Capteur de pluie (module YL-83) | Pluie | GPIO 27 |
| Module relais 5 V + pompe / électrovanne | Irrigation | GPIO 26 |

### Mise en service du vrai boîtier (firmware v2)

Le guide détaillé, l'adresse du serveur et la clé sont dans **Tableau de bord › Boîtier**.

1. **Lancer le serveur seul** (sans simulateur) : double-cliquez sur `demarrer_reel.bat`.
   Le terminal affiche l'adresse à donner au boîtier, par exemple `http://192.168.1.20:8000`.
2. **Pare-feu Windows** : autoriser le port 8000 pour le réseau local. Dans PowerShell **administrateur** :

   ```powershell
   New-NetFirewallRule -DisplayName "Saqiya serveur" -Direction Inbound -Protocol TCP -LocalPort 8000 -RemoteAddress LocalSubnet -Action Allow
   ```
3. **IDE Arduino 2** + cartes « esp32 » (Espressif) + bibliothèques *WiFiManager* (tzapu), *ArduinoJson*,
   *DHT sensor library*, *OneWire*, *DallasTemperature*.
4. Dans `esp32_smart_irrigation.ino` : indiquez les capteurs présents (`HAS_…`), le type de relais
   (`RELAY_ACTIVE_LOW`), puis téléversez sur « ESP32 Dev Module ».
5. **Configuration sans recompiler** : sur un téléphone, rejoignez le WiFi `Saqiya-Config`
   (mot de passe `saqiya1234`), choisissez votre WiFi et collez l'adresse du serveur et la clé.
   Pour refaire la configuration : bouton **BOOT maintenu 3 s**.
6. La page **Boîtier** passe au vert : signal WiFi, adresse IP, version du firmware, nombre de mesures.
7. Calibrez l'humidité du sol (`SOIL_DRY_RAW` / `SOIL_WET_RAW`) et la sonde pH (`PH7_VOLT` / `PH4_VOLT`).

Voyant de la carte : clignotement lent = OK · rapide = pas de WiFi · double = serveur injoignable ou clé refusée · fixe = pompe en marche.

**Sécurité de la pompe** : le boîtier coupe la pompe lui-même à la fin de la durée reçue, avec un garde-fou
absolu de 30 minutes, même si le serveur ou le WiFi tombe. Au démarrage, la sortie relais est forcée à l'arrêt.

**Repartir de zéro** : la page Boîtier permet d'effacer les mesures de démonstration (une sauvegarde est créée
dans `data/sauvegardes/`). Réglages et photos sont conservés.

---

### Boîtier avec capteur de sol 7-en-1 (RS485)

Programme : `firmware/saqiya_capteur_7en1/saqiya_capteur_7en1.ino` (bibliothèques WiFiManager et ArduinoJson v7).

| Élément | Broche ESP32 |
|---|---|
| MAX485 RO | GPIO16 (RX2) |
| MAX485 DI | GPIO17 (TX2) |
| MAX485 DE + RE | GPIO4 |
| Capteur A / B | A / B du MAX485 |
| Alimentation capteur | 12 V, **masse commune avec l'ESP32** |
| Relais pompe (facultatif) | GPIO26 |

Le débit (4800 ou 9600 bauds) est détecté tout seul. Mesures envoyées : humidité, température du sol, EC (µS/cm, convertie en dS/m), pH, N, P, K.
La température et l'humidité de l'air viennent de la météo du lieu (marquées « météo du lieu » sur le tableau de bord).

## 5. API REST

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/readings` | Envoi des mesures par le boîtier (en-tête `X-Device-Key`) → commande de pompe |
| GET | `/api/status` | État complet (mesures, pompe, décision, météo, maladies, sol) |
| GET | `/api/readings?hours=24` | Historique des mesures |
| POST | `/api/pump` | `{"action": "on", "duration_s": 300}` ou `{"action": "off"}` |
| GET | `/api/irrigation/events` | Historique des arrosages |
| GET | `/api/disease` | Risques de maladies |
| GET | `/api/alerts` · POST `/api/alerts/{id}/ack` | Alertes |
| GET / PUT | `/api/settings` | Réglages de la parcelle |
| POST | `/api/chat` | `{"message": "..."}` → réponse du chatbot |

---

## 6. Limites et améliorations possibles

- Le tableau de bord n'a pas d'authentification : à utiliser sur un réseau local, ou ajouter un login
  avant de l'exposer sur Internet.
- Remplacer les données d'entraînement synthétiques par des observations réelles.
- Ajouter la détection de maladies par photo des feuilles (vision par ordinateur).
- Notifications SMS / WhatsApp pour les alertes.
- Plusieurs parcelles / plusieurs boîtiers.
