"""Pont USB : lit le boîtier ESP32 branché en USB (programme de test du capteur 7-en-1)
et envoie ses mesures au système, sans WiFi et sans reprogrammer la carte.

Le programme de l'ESP32 affiche (115200 bauds) des blocs du type :
    Humidite    : 27.4 %
    Temperature : 18.6 °C
    EC          : 412 uS/cm
    pH          : 6.8
    Azote(N)    : 38 mg/kg
    Phosphore(P): 21 mg/kg
    Potassium(K): 156 mg/kg
    ========================================
Les lignes « Erreur : … » signalent un capteur muet.
"""
import re
import threading
import time

try:
    import serial
    from serial.tools import list_ports
except ImportError:  # pyserial absent : le pont reste inactif
    serial = None

BAUD = 115200
DEVICE_ID = "esp32-usb-7en1"
# puces USB-série des cartes ESP32 (CP210x, CH340/CH9102, FTDI, USB natif Espressif)
USB_IDS = {0x10C4, 0x1A86, 0x0403, 0x303A}

status = {"available": serial is not None, "port": None, "connected": False,
          "last_line": "", "last_reading_ts": None, "error": None}

_NUM = re.compile(r"(-?\d+(?:[.,]\d+)?)")


def _field(label):
    """Associe l'étiquette d'une ligne à un champ de mesure."""
    lab = label.lower().replace("é", "e").replace("è", "e")
    if "humid" in lab:
        return "soil_moisture"
    if "temp" in lab:
        return "soil_temp"
    if "phosph" in lab or lab.endswith("(p)"):
        return "p"
    if "potass" in lab or lab.endswith("(k)"):
        return "k"
    if "azot" in lab or "nitro" in lab or lab.endswith("(n)"):
        return "n"
    if lab.startswith("ph"):
        return "soil_ph"
    if lab.startswith("ec") or "conduct" in lab:
        return "soil_ec_us"
    return None


def parse_line(line, block):
    """Ajoute la valeur de la ligne au bloc. Renvoie 'flush', 'error' ou None."""
    s = line.strip()
    if not s:
        return None
    if s.startswith("==") and block:
        return "flush"
    if s.lower().startswith("erreur"):
        return "error"
    if ":" not in s:
        return None
    label, _, rest = s.partition(":")
    f = _field(label.strip())
    m = _NUM.search(rest)
    if not f or not m:
        return None
    block[f] = float(m.group(1).replace(",", "."))
    return "flush" if f == "k" and len(block) >= 5 else None


def _find_port():
    ports = list(list_ports.comports())
    for p in ports:
        if p.vid in USB_IDS:
            return p.device
    for p in ports:   # à défaut : tout port USB (pas le COM1 de la carte mère)
        if p.vid is not None:
            return p.device
    return None


SEND_EVERY = 30   # secondes : le programme mesure toutes les 2 s, on envoie la moyenne toutes les 30 s


class Feeder:
    """Transforme les lignes du moniteur série en mesures moyennées, prêtes pour le serveur."""

    def __init__(self, port):
        self.port, self.block, self.sums, self.n = port, {}, {}, 0
        self.window_start, self.last_error_sent, self.first = None, 0, True

    def _body(self, ok, data=None):
        return {"device_id": DEVICE_ID, "fw": "usb-test-7en1", "sensor": "7en1", "sensor_ok": ok,
                "ip": f"USB {self.port}", **(data or {})}

    def feed(self, line, now):
        """Renvoie la liste des mesures à envoyer (souvent vide)."""
        out = []
        ev = parse_line(line, self.block)
        if ev == "flush" and self.block:
            for k, v in self.block.items():
                self.sums[k] = self.sums.get(k, 0.0) + v
            self.n += 1
            self.block = {}
            if self.window_start is None:
                self.window_start = now
            # la première mesure part tout de suite (le tableau de bord réagit vite), puis une moyenne toutes les 30 s
            if self.first or now - self.window_start >= SEND_EVERY:
                out.append(self._flush(now))
        elif ev == "error":
            self.block = {}
            if self.n and now - self.window_start >= SEND_EVERY:
                out.append(self._flush(now))          # envoie d'abord les bonnes mesures déjà lues
            elif not self.n and now - self.window_start >= SEND_EVERY and now - self.last_error_sent >= SEND_EVERY:
                self.last_error_sent = now            # capteur muet pendant toute une fenêtre de 30 s
                out.append(self._body(False))
            if self.window_start is None:
                self.window_start = now
        return out

    def _flush(self, now):
        avg = {k: round(s / self.n, 2) for k, s in self.sums.items()}
        for k in ("n", "p", "k", "soil_ec_us"):
            if k in avg:
                avg[k] = round(avg[k])
        self.sums, self.n, self.window_start, self.first = {}, 0, now, False
        return self._body(True, avg)


def _open(port):
    # ouverture sans toucher aux lignes DTR/RTS : sinon certaines cartes ESP32 redémarrent
    # ou restent bloquées en mode programmation
    ser = serial.Serial()
    ser.port, ser.baudrate, ser.timeout = port, BAUD, 2
    ser.dtr, ser.rts = False, False
    ser.open()
    return ser


def _run(ingest):
    while True:
        port = _find_port()
        if not port:
            status.update(port=None, connected=False)
            time.sleep(5)
            continue
        try:
            with _open(port) as ser:
                status.update(port=port, connected=True, error=None)
                print(f" Pont USB : boîtier détecté sur {port}")
                feeder = Feeder(port)
                while True:
                    raw = ser.readline()
                    if not raw:
                        continue
                    line = raw.decode("utf-8", "replace").strip()
                    if line:
                        status["last_line"] = line[:120]
                    for body in feeder.feed(line, time.time()):
                        code, resp = ingest(body, f"USB {port}")
                        if code == 200 and body.get("sensor_ok"):
                            status["last_reading_ts"] = time.time()
                            status["error"] = None
                        elif code != 200 and body.get("sensor_ok"):
                            status["error"] = resp.get("error")
        except Exception as e:  # câble débranché, port occupé (moniteur série Arduino ouvert)…
            status.update(connected=False, error=str(e)[:160])
            print(f" Pont USB : {port} indisponible ({e.__class__.__name__}) — nouvel essai dans 5 s")
            time.sleep(5)


def start(ingest):
    if serial is None:
        print(" Pont USB : inactif (installez-le avec « python -m pip install pyserial »)")
        return
    threading.Thread(target=_run, args=(ingest,), daemon=True).start()
    print(" Pont USB : en attente d'un ESP32 branché en USB…")
