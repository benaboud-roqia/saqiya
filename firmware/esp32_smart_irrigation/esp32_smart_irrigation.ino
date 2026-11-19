/*
 * Sāqiya — boîtier IoT de la parcelle (firmware v2)
 * Carte : ESP32 DevKit (Arduino IDE 2.x, carte « ESP32 Dev Module »)
 *
 * NOUVEAU EN v2
 *   - Configuration depuis un téléphone, sans recompiler : au premier démarrage, le boîtier crée
 *     le réseau WiFi « Saqiya-Config » (mot de passe : saqiya1234). On s'y connecte, une page s'ouvre :
 *     on choisit son WiFi, on saisit l'adresse du serveur et la clé du boîtier. C'est enregistré.
 *   - Pour refaire la configuration : maintenir le bouton BOOT 3 secondes (au démarrage ou en marche).
 *   - Reconnexion WiFi automatique, voyant d'état, test de connexion au serveur au démarrage.
 *   - Capteurs activables un par un (un capteur non branché n'envoie pas de fausse valeur).
 *   - Relais actif à l'état bas ou haut (la plupart des modules relais sont actifs à l'état BAS).
 *   - Sécurité : la pompe s'arrête toute seule à la fin de la durée reçue, même sans serveur.
 *
 * Bibliothèques (Outils > Gérer les bibliothèques) :
 *   WiFiManager (tzapu), ArduinoJson (Benoit Blanchon, v7), DHT sensor library (Adafruit),
 *   OneWire, DallasTemperature
 *
 * Câblage :
 *   Humidité du sol capacitive v1.2 ...... GPIO 34 (ADC)      Alim 3,3 V
 *   Température du sol DS18B20 ........... GPIO 4  (+ 4,7 kΩ entre DATA et 3,3 V)
 *   DHT22 (air) .......................... GPIO 15
 *   Sonde pH analogique .................. GPIO 35 (ADC)
 *   Sonde EC analogique .................. GPIO 32 (ADC)
 *   Capteur de pluie (sortie D0) ......... GPIO 27 (LOW = pluie)
 *   Capteur NPK RS485 via MAX485 ......... RO→GPIO16  DI→GPIO17  DE+RE→GPIO5   (9600 bauds)
 *   Relais pompe ......................... GPIO 26
 *   Voyant d'état ........................ GPIO 2 (LED intégrée)
 *   Bouton de configuration .............. GPIO 0 (bouton BOOT de la carte)
 */
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define FW_VERSION "2.0.0"

// ---------- Capteurs présents (1 = branché, 0 = absent) ----------
#define HAS_SOIL_TEMP 1
#define HAS_DHT       1
#define HAS_PH        1
#define HAS_EC        1
#define HAS_NPK       1
#define HAS_RAIN      1

// ---------- Relais ----------
#define RELAY_ACTIVE_LOW 1   // 1 si le relais colle quand la broche est à LOW (cas le plus courant)

// ---------- Valeurs par défaut (modifiables ensuite depuis le portail) ----------
const char* DEFAULT_SERVER = "http://192.168.100.36:8000";
const char* DEFAULT_KEY    = "change-me";
const char* DEFAULT_ID     = "esp32-parcelle-1";
const char* PORTAL_SSID    = "Saqiya-Config";
const char* PORTAL_PASS    = "saqiya1234";

const unsigned long SEND_INTERVAL_MS    = 30000;   // envoi normal
const unsigned long SEND_INTERVAL_PUMP  = 5000;    // envoi pendant l'arrosage
const unsigned long MAX_PUMP_MS         = 30UL * 60UL * 1000UL;  // garde-fou absolu : 30 min

// ---------- Calibration ----------
const int   SOIL_DRY_RAW = 3200;   // valeur brute capteur à l'air libre
const int   SOIL_WET_RAW = 1300;   // valeur brute capteur dans un verre d'eau
const float PH7_VOLT = 1.65, PH4_VOLT = 2.10;   // tensions mesurées dans les solutions tampons
const float EC_FACTOR = 1.0;                    // dS/m par volt (solution étalon 1,413 mS/cm)

// ---------- Broches ----------
#define PIN_SOIL_MOIST 34
#define PIN_SOIL_TEMP  4
#define PIN_DHT        15
#define PIN_PH         35
#define PIN_EC         32
#define PIN_RAIN       27
#define PIN_PUMP       26
#define PIN_RS485_DE   5
#define RS485_RX       16
#define RS485_TX       17
#define PIN_LED        2
#define PIN_BOOT       0

DHT dht(PIN_DHT, DHT22);
OneWire oneWire(PIN_SOIL_TEMP);
DallasTemperature soilTemp(&oneWire);
Preferences prefs;
WiFiManager wm;

char serverUrl[100], deviceKey[64], deviceId[40];
bool pumpOn = false;
unsigned long pumpDeadline = 0, pumpStarted = 0, lastSend = 0, lastWifiTry = 0;
int lastHttpCode = 0;

// ================= utilitaires =================
void setPump(bool on) {
  if (on && !pumpOn) pumpStarted = millis();
  pumpOn = on;
  digitalWrite(PIN_PUMP, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

void led(bool on) { digitalWrite(PIN_LED, on ? HIGH : LOW); }

// voyant : fixe = pompe en marche · clignote lentement = tout va bien · rapide = pas de WiFi · double = erreur serveur
void updateLed() {
  unsigned long t = millis();
  if (pumpOn) { led(true); return; }
  if (WiFi.status() != WL_CONNECTED) { led((t / 150) % 2); return; }
  if (lastHttpCode != 200 && lastHttpCode != 0) { unsigned long p = t % 1200; led(p < 100 || (p > 250 && p < 350)); return; }
  led((t % 2000) < 80);
}

void loadConfig() {
  prefs.begin("saqiya", true);
  strlcpy(serverUrl, prefs.getString("server", DEFAULT_SERVER).c_str(), sizeof(serverUrl));
  strlcpy(deviceKey, prefs.getString("key", DEFAULT_KEY).c_str(), sizeof(deviceKey));
  strlcpy(deviceId,  prefs.getString("id", DEFAULT_ID).c_str(), sizeof(deviceId));
  prefs.end();
  // retire un éventuel « / » final
  size_t n = strlen(serverUrl);
  if (n && serverUrl[n - 1] == '/') serverUrl[n - 1] = 0;
}

void saveConfig(const char* s, const char* k, const char* id) {
  prefs.begin("saqiya", false);
  prefs.putString("server", s);
  prefs.putString("key", k);
  prefs.putString("id", id);
  prefs.end();
}

bool bootHeld(unsigned long ms) {
  if (digitalRead(PIN_BOOT) != LOW) return false;
  unsigned long t0 = millis();
  while (digitalRead(PIN_BOOT) == LOW) {
    led((millis() / 80) % 2);
    if (millis() - t0 >= ms) return true;
    delay(10);
  }
  return false;
}

// ================= portail de configuration =================
WiFiManagerParameter* pServer;
WiFiManagerParameter* pKey;
WiFiManagerParameter* pId;

void onSaveParams() {
  saveConfig(pServer->getValue(), pKey->getValue(), pId->getValue());
  loadConfig();
  Serial.printf("Configuration enregistrée : %s (%s)\n", serverUrl, deviceId);
}

void setupPortal() {
  pServer = new WiFiManagerParameter("server", "Adresse du serveur (ex. http://192.168.1.20:8000)", serverUrl, 99);
  pKey    = new WiFiManagerParameter("key", "Clé du boîtier (page Boîtier du tableau de bord)", deviceKey, 63);
  pId     = new WiFiManagerParameter("id", "Nom du boîtier", deviceId, 39);
  wm.addParameter(pServer);
  wm.addParameter(pKey);
  wm.addParameter(pId);
  wm.setSaveParamsCallback(onSaveParams);
  wm.setTitle("Sāqiya — boîtier de la parcelle");
  wm.setConfigPortalTimeout(300);     // 5 min puis on continue (la pompe reste sûre)
  wm.setConnectTimeout(20);
  wm.setWiFiAutoReconnect(true);
}

void openPortal() {
  Serial.println("Portail de configuration ouvert : WiFi « Saqiya-Config », mot de passe saqiya1234");
  setPump(false);
  wm.startConfigPortal(PORTAL_SSID, PORTAL_PASS);
}

// ================= capteurs =================
float readAvgVolt(int pin) {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(pin); delay(4); }
  return (sum / 20.0) * 3.3 / 4095.0;
}

float readSoilMoisture() {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(PIN_SOIL_MOIST); delay(4); }
  float raw = sum / 20.0;
  if (raw < 50 || raw > 4050) return NAN;   // capteur débranché
  return constrain((SOIL_DRY_RAW - raw) * 100.0 / (SOIL_DRY_RAW - SOIL_WET_RAW), 0, 100);
}

uint16_t crc16(const uint8_t* buf, int len) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < len; i++) {
    crc ^= buf[i];
    for (int b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}

int readModbusRegister(uint16_t reg) {
  uint8_t req[8] = {0x01, 0x03, (uint8_t)(reg >> 8), (uint8_t)reg, 0x00, 0x01, 0, 0};
  uint16_t crc = crc16(req, 6);
  req[6] = crc & 0xFF; req[7] = crc >> 8;
  while (Serial2.available()) Serial2.read();
  digitalWrite(PIN_RS485_DE, HIGH);
  Serial2.write(req, 8);
  Serial2.flush();
  digitalWrite(PIN_RS485_DE, LOW);
  uint8_t resp[7];
  unsigned long t0 = millis();
  int n = 0;
  while (n < 7 && millis() - t0 < 300) if (Serial2.available()) resp[n++] = Serial2.read();
  if (n < 7 || crc16(resp, 5) != (resp[5] | (resp[6] << 8))) return -1;
  return (resp[3] << 8) | resp[4];
}

// ================= réseau =================
void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiTry < 10000) return;
  lastWifiTry = millis();
  Serial.println("WiFi perdu, reconnexion…");
  WiFi.reconnect();
}

void pingServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/device/ping");
  http.addHeader("X-Device-Key", deviceKey);
  http.setTimeout(5000);
  int code = http.GET();
  lastHttpCode = code;
  if (code == 200) Serial.println("Serveur joignable, clé acceptée.");
  else if (code == 401) Serial.println("Serveur joignable mais CLÉ REFUSÉE : vérifiez la clé dans le portail.");
  else Serial.printf("Serveur injoignable (%d). Vérifiez l'adresse et le pare-feu du PC.\n", code);
  http.end();
}

void sendReadings() {
  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["fw"] = FW_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["uptime_s"] = millis() / 1000;
  doc["ip"] = WiFi.localIP().toString();
  doc["pump_on"] = pumpOn;

  float m = readSoilMoisture();
  if (!isnan(m)) doc["soil_moisture"] = m;

  float tSoil = NAN;
#if HAS_SOIL_TEMP
  soilTemp.requestTemperatures();
  tSoil = soilTemp.getTempCByIndex(0);
  if (tSoil > -100) doc["soil_temp"] = tSoil; else tSoil = NAN;
#endif
#if HAS_DHT
  float tAir = dht.readTemperature(), hAir = dht.readHumidity();
  if (!isnan(tAir)) doc["air_temp"] = tAir;
  if (!isnan(hAir)) doc["air_humidity"] = hAir;
#endif
#if HAS_PH
  float v = readAvgVolt(PIN_PH);
  if (v > 0.05 && v < 3.25) doc["soil_ph"] = constrain(7.0 + (v - PH7_VOLT) * (3.0 / (PH7_VOLT - PH4_VOLT)), 0, 14);
#endif
#if HAS_EC
  float ve = readAvgVolt(PIN_EC);
  if (ve > 0.02) doc["soil_ec"] = (ve * EC_FACTOR) / (1.0 + 0.02 * ((isnan(tSoil) ? 25 : tSoil) - 25.0));
#endif
#if HAS_NPK
  int n = readModbusRegister(0x001E), p = readModbusRegister(0x001F), k = readModbusRegister(0x0020);
  if (n >= 0) doc["n"] = n;
  if (p >= 0) doc["p"] = p;
  if (k >= 0) doc["k"] = k;
#endif
#if HAS_RAIN
  doc["rain_detected"] = digitalRead(PIN_RAIN) == LOW ? 1 : 0;
#endif

  String body;
  serializeJson(doc, body);
  Serial.println("→ " + body);
  if (WiFi.status() != WL_CONNECTED) { Serial.println("Pas de WiFi : mesure non envoyée."); return; }

  HTTPClient http;
  http.begin(String(serverUrl) + "/api/readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  http.setTimeout(8000);
  int code = http.POST(body);
  lastHttpCode = code;
  if (code == 200) {
    JsonDocument resp;
    if (!deserializeJson(resp, http.getString())) {
      bool on = resp["pump"] | false;
      long secs = resp["seconds_remaining"] | 0;
      setPump(on && secs > 0);
      pumpDeadline = millis() + (unsigned long)secs * 1000UL;
      Serial.printf("← pompe %s (%ld s) : %s\n", on ? "ON" : "OFF", secs, (const char*)(resp["decision"] | ""));
    }
  } else if (code == 401) {
    Serial.println("Clé refusée par le serveur. Maintenez BOOT 3 s pour corriger la configuration.");
    setPump(false);
  } else {
    Serial.printf("Erreur HTTP %d — la pompe s'arrêtera à l'échéance prévue.\n", code);
  }
  http.end();
}

// ================= programme =================
void setup() {
  digitalWrite(PIN_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);   // pompe coupée avant même d'activer la sortie
  pinMode(PIN_PUMP, OUTPUT);
  setPump(false);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_RAIN, INPUT_PULLUP);
  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
  analogReadResolution(12);
  dht.begin();
  soilTemp.begin();

  Serial.printf("\nSāqiya boîtier v%s\n", FW_VERSION);
  loadConfig();
  setupPortal();

  if (bootHeld(3000)) {
    Serial.println("Réinitialisation de la configuration WiFi.");
    wm.resetSettings();
    openPortal();
  } else if (!wm.autoConnect(PORTAL_SSID, PORTAL_PASS)) {
    Serial.println("WiFi non configuré : le boîtier continue sans réseau (pompe coupée).");
  }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("WiFi OK — IP %s — serveur %s\n", WiFi.localIP().toString().c_str(), serverUrl);
  pingServer();
}

void loop() {
  // sécurité : arrêt local de la pompe à l'échéance, et garde-fou absolu
  if (pumpOn && ((long)(millis() - pumpDeadline) >= 0 || millis() - pumpStarted > MAX_PUMP_MS)) {
    setPump(false);
    Serial.println("Pompe arrêtée localement (échéance atteinte).");
  }
  // bouton BOOT maintenu 3 s en marche → portail de configuration
  if (bootHeld(3000)) openPortal();

  ensureWifi();
  unsigned long interval = pumpOn ? SEND_INTERVAL_PUMP : SEND_INTERVAL_MS;
  if (lastSend == 0 || millis() - lastSend >= interval) {
    lastSend = millis();
    sendReadings();
  }
  updateLed();
  delay(20);
}
