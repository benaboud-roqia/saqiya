/*
 * Sāqiya — boîtier avec capteur de sol 7-en-1 RS485 (Modbus RTU)
 * Basé sur le programme de test du capteur : mêmes broches, même trame, même décodage.
 *
 * Mesures envoyées au serveur toutes les 30 s :
 *   humidité du sol (%), température du sol (°C), conductivité EC (µS/cm → dS/m), pH, N, P, K (mg/kg)
 *
 * Câblage (identique au programme de test) :
 *   Module MAX485 : RO → GPIO16 (RX2) · DI → GPIO17 (TX2) · DE + RE → GPIO4
 *   Capteur 7-en-1 : A/B vers A/B du MAX485, alimentation 12 V (masse commune avec l'ESP32)
 *   Relais de pompe (facultatif) → GPIO26 · voyant → GPIO2 (LED de la carte) · bouton BOOT → GPIO0
 *
 * Premier démarrage : se connecter au WiFi « Saqiya-Config » (mot de passe saqiya1234) depuis un
 * téléphone, choisir le WiFi de la maison, coller l'adresse du serveur et la clé du boîtier
 * (page « Boîtier » du tableau de bord). Bouton BOOT maintenu 3 s = refaire la configuration.
 *
 * Bibliothèques : WiFiManager (tzapu), ArduinoJson (v7).
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define FW_VERSION "3.0.0-7en1"

// ---------- Capteur 7-en-1 (valeurs du programme de test) ----------
#define RXD2 16
#define TXD2 17
#define DE_RE_PIN 4
const byte modbusRequest[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x07, 0x04, 0x08};  // adresse 1, 7 registres dès 0x0000
byte response[19];
long sensorBaud = 0;   // détecté au démarrage : 4800 (usine) puis 9600

// ---------- Pompe (facultative) ----------
#define HAS_PUMP 1            // 0 si aucun relais n'est branché
#define PIN_PUMP 26
#define RELAY_ACTIVE_LOW 1    // la plupart des modules relais collent à l'état BAS
const unsigned long MAX_PUMP_MS = 30UL * 60UL * 1000UL;   // garde-fou absolu : 30 min

// ---------- Réseau ----------
#define PIN_LED 2
#define PIN_BOOT 0
const char* DEFAULT_SERVER = "http://192.168.100.36:8000";
const char* DEFAULT_KEY = "change-me";
const char* DEFAULT_ID = "esp32-capteur-7en1";
const char* PORTAL_SSID = "Saqiya-Config";
const char* PORTAL_PASS = "saqiya1234";
const unsigned long SEND_INTERVAL_MS = 30000;
const unsigned long SEND_INTERVAL_PUMP = 5000;

Preferences prefs;
WiFiManager wm;
WiFiManagerParameter *pServer, *pKey, *pId;
char serverUrl[100], deviceKey[64], deviceId[40];
bool pumpOn = false;
unsigned long pumpDeadline = 0, pumpStarted = 0, lastSend = 0, lastWifiTry = 0;
int lastHttpCode = 0;
bool sensorOk = false;

// ================= capteur 7-en-1 =================
uint16_t crc16(const byte* buf, int len) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < len; i++) {
    crc ^= buf[i];
    for (int b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}

// Lit le capteur ; renvoie true si la trame est valide (même logique que le programme de test, + contrôle CRC)
bool readSoil(float& humidite, float& temperature, uint16_t& ec, float& ph, uint16_t& n, uint16_t& p, uint16_t& k) {
  while (Serial2.available()) Serial2.read();
  digitalWrite(DE_RE_PIN, HIGH);
  delay(5);
  Serial2.write(modbusRequest, sizeof(modbusRequest));
  Serial2.flush();
  delay(2);
  digitalWrite(DE_RE_PIN, LOW);

  unsigned long startTime = millis();
  while (Serial2.available() < 19 && (millis() - startTime) < 1000) delay(5);
  if (Serial2.available() < 19) return false;
  for (int i = 0; i < 19; i++) response[i] = Serial2.read();
  if (response[0] != 0x01 || response[1] != 0x03 || response[2] != 0x0E) return false;
  if (crc16(response, 17) != (uint16_t)(response[17] | (response[18] << 8))) return false;

  humidite = ((response[3] << 8) | response[4]) / 10.0;
  int16_t tempBrute = (response[5] << 8) | response[6];
  temperature = tempBrute / 10.0;
  ec = (response[7] << 8) | response[8];
  ph = ((response[9] << 8) | response[10]) / 10.0;
  n = (response[11] << 8) | response[12];
  p = (response[13] << 8) | response[14];
  k = (response[15] << 8) | response[16];
  return true;
}

// Essaie 4800 bauds (réglage d'usine), puis 9600
void detectBaud() {
  const long bauds[] = {4800, 9600};
  float h, t, ph; uint16_t ec, n, p, k;
  for (long b : bauds) {
    Serial2.end();
    Serial2.begin(b, SERIAL_8N1, RXD2, TXD2);
    delay(100);
    for (int tries = 0; tries < 3; tries++) {
      if (readSoil(h, t, ec, ph, n, p, k)) {
        sensorBaud = b;
        Serial.printf("Capteur 7-en-1 détecté à %ld bauds.\n", b);
        return;
      }
      delay(300);
    }
  }
  sensorBaud = 4800;
  Serial2.end();
  Serial2.begin(sensorBaud, SERIAL_8N1, RXD2, TXD2);
  Serial.println("Capteur muet : vérifiez le 12 V, les fils A/B et la masse commune.");
}

// ================= pompe et voyant =================
void setPump(bool on) {
#if HAS_PUMP
  if (on && !pumpOn) pumpStarted = millis();
  pumpOn = on;
  digitalWrite(PIN_PUMP, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
#else
  pumpOn = false;
#endif
}

// fixe = pompe · lent = OK · rapide = pas de WiFi · double = serveur/clé · triple = capteur muet
void updateLed() {
  unsigned long t = millis();
  bool on;
  if (pumpOn) on = true;
  else if (WiFi.status() != WL_CONNECTED) on = (t / 150) % 2;
  else if (lastHttpCode != 200 && lastHttpCode != 0) { unsigned long q = t % 1200; on = q < 100 || (q > 250 && q < 350); }
  else if (!sensorOk) { unsigned long q = t % 1500; on = q < 100 || (q > 250 && q < 350) || (q > 500 && q < 600); }
  else on = (t % 2000) < 80;
  digitalWrite(PIN_LED, on ? HIGH : LOW);
}

// ================= configuration =================
void loadConfig() {
  prefs.begin("saqiya", true);
  strlcpy(serverUrl, prefs.getString("server", DEFAULT_SERVER).c_str(), sizeof(serverUrl));
  strlcpy(deviceKey, prefs.getString("key", DEFAULT_KEY).c_str(), sizeof(deviceKey));
  strlcpy(deviceId, prefs.getString("id", DEFAULT_ID).c_str(), sizeof(deviceId));
  prefs.end();
  size_t len = strlen(serverUrl);
  if (len && serverUrl[len - 1] == '/') serverUrl[len - 1] = 0;
}

void onSaveParams() {
  prefs.begin("saqiya", false);
  prefs.putString("server", pServer->getValue());
  prefs.putString("key", pKey->getValue());
  prefs.putString("id", pId->getValue());
  prefs.end();
  loadConfig();
  Serial.printf("Configuration enregistrée : %s (%s)\n", serverUrl, deviceId);
}

bool bootHeld(unsigned long ms) {
  if (digitalRead(PIN_BOOT) != LOW) return false;
  unsigned long t0 = millis();
  while (digitalRead(PIN_BOOT) == LOW) {
    digitalWrite(PIN_LED, (millis() / 80) % 2);
    if (millis() - t0 >= ms) return true;
    delay(10);
  }
  return false;
}

void openPortal() {
  Serial.println("Portail ouvert : WiFi « Saqiya-Config », mot de passe saqiya1234");
  setPump(false);
  wm.startConfigPortal(PORTAL_SSID, PORTAL_PASS);
}

// ================= envoi au serveur =================
void sendReadings() {
  float h = 0, t = 0, ph = 0; uint16_t ec = 0, n = 0, p = 0, k = 0;
  sensorOk = readSoil(h, t, ec, ph, n, p, k);

  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["fw"] = FW_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["uptime_s"] = millis() / 1000;
  doc["ip"] = WiFi.localIP().toString();
  doc["pump_on"] = pumpOn;
  doc["sensor"] = "7en1";
  doc["sensor_ok"] = sensorOk;
  if (sensorOk) {
    doc["soil_moisture"] = h;
    doc["soil_temp"] = t;
    doc["soil_ec_us"] = ec;          // µS/cm, converti en dS/m par le serveur
    doc["soil_ph"] = ph;
    doc["n"] = n;
    doc["p"] = p;
    doc["k"] = k;
    Serial.printf("Sol %.1f %% · %.1f °C · EC %u µS/cm · pH %.1f · N %u P %u K %u\n", h, t, ec, ph, n, p, k);
  } else {
    Serial.println("Erreur capteur : aucune trame valide (12 V, fils A/B, débit).");
  }

  if (WiFi.status() != WL_CONNECTED) { Serial.println("Pas de WiFi : mesure non envoyée."); return; }
  String body;
  serializeJson(doc, body);
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
    Serial.println("Clé refusée par le serveur : maintenez BOOT 3 s pour corriger la configuration.");
    setPump(false);
  } else if (code == 400) {
    Serial.println("Serveur : aucune mesure valide (capteur muet ?).");
  } else {
    Serial.printf("Serveur injoignable (%d) : vérifiez l'adresse et le pare-feu du PC.\n", code);
  }
  http.end();
}

// ================= programme =================
void setup() {
#if HAS_PUMP
  digitalWrite(PIN_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);   // pompe coupée avant d'activer la sortie
  pinMode(PIN_PUMP, OUTPUT);
#endif
  setPump(false);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(DE_RE_PIN, OUTPUT);
  digitalWrite(DE_RE_PIN, LOW);
  Serial.begin(115200);
  Serial.printf("\nSāqiya — capteur de sol 7-en-1 (v%s)\n", FW_VERSION);

  detectBaud();
  loadConfig();
  pServer = new WiFiManagerParameter("server", "Adresse du serveur (ex. http://192.168.1.20:8000)", serverUrl, 99);
  pKey = new WiFiManagerParameter("key", "Clé du boîtier (page Boîtier du tableau de bord)", deviceKey, 63);
  pId = new WiFiManagerParameter("id", "Nom du boîtier", deviceId, 39);
  wm.addParameter(pServer); wm.addParameter(pKey); wm.addParameter(pId);
  wm.setSaveParamsCallback(onSaveParams);
  wm.setTitle("Sāqiya — boîtier de la parcelle");
  wm.setConfigPortalTimeout(300);
  wm.setConnectTimeout(20);

  if (bootHeld(3000)) { wm.resetSettings(); openPortal(); }
  else if (!wm.autoConnect(PORTAL_SSID, PORTAL_PASS)) Serial.println("WiFi non configuré : mesures non envoyées.");
  if (WiFi.status() == WL_CONNECTED) Serial.printf("WiFi OK — IP %s — serveur %s\n", WiFi.localIP().toString().c_str(), serverUrl);
}

void loop() {
  if (pumpOn && ((long)(millis() - pumpDeadline) >= 0 || millis() - pumpStarted > MAX_PUMP_MS)) {
    setPump(false);
    Serial.println("Pompe arrêtée localement (échéance atteinte).");
  }
  if (bootHeld(3000)) openPortal();
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > 10000) { lastWifiTry = millis(); WiFi.reconnect(); }

  unsigned long interval = pumpOn ? SEND_INTERVAL_PUMP : SEND_INTERVAL_MS;
  if (lastSend == 0 || millis() - lastSend >= interval) {
    lastSend = millis();
    sendReadings();
  }
  updateLed();
  delay(20);
}
