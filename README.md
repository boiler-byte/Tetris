# Neon Stack – Tetris PWA

Ein fertiges, mobiloptimiertes Block-Puzzle-Spiel in reinem HTML, CSS und JavaScript – ohne Build-Schritt, Framework oder externe Abhängigkeiten.

## Starten

1. Den ZIP-Ordner entpacken.
2. Ein Terminal im Ordner `neon-stack` öffnen.
3. Einen lokalen Webserver starten:

   ```bash
   python3 -m http.server 8000
   ```

4. Im Browser `http://localhost:8000` öffnen.

Die `index.html` lässt sich auch direkt öffnen. Für **PWA-Installation und Offline-Caching** muss die App jedoch über **HTTPS oder localhost** laufen. Auf ein Smartphone kann sie über einen HTTPS-Webserver bereitgestellt und anschließend über das Browser-Menü **Zum Startbildschirm hinzufügen / App installieren** installiert werden.

## Mobile Steuerung

**Wischgesten funktionieren auf der gesamten Seite**, auch über den Vorschau-Kacheln, dem Scoreboard und den freien Rändern. Ton, Pause, HOLD sowie andere Bedienelemente bleiben davon ausgenommen.

- **Links/rechts wischen:** Stein seitwärts bewegen.
- **Nach unten ziehen:** Stein langsam nach unten bewegen.
- **Schnell nach unten wischen:** Sofort abwerfen (Hard Drop).
- **Auf einer beliebigen freien Fläche tippen:** Stein drehen – auch auf NEXT, Scoreboard und Hintergrund.
- **Nach oben wischen (überall):** Stein drehen.
- **Beim Wischen die Richtung wechseln:** Horizontal und vertikal lassen sich in einer durchgehenden Touch-Geste kombinieren.
- **HOLD-Kachel:** Aktuellen Stein aufbewahren / tauschen.
- **Ton und Pause:** Die beiden Tasten stehen übereinander links neben der HOLD-Kachel.

**500-ms-Lock-Delay:** Sobald der Stein festen Untergrund berührt, verbleiben 500 Millisekunden für seitliches Verschieben oder Drehen. Eine bereits laufende horizontale oder vertikale Wischbewegung kann dabei weitergeführt und in die andere Richtung geändert werden. Bewegungen oder Drehungen setzen die 500 Millisekunden nicht zurück. Verlässt der Stein den Untergrund (z. B. über einer Lücke), beginnt bei der nächsten Landung ein neues 500-ms-Fenster. Ein gezielter schneller Wisch nach unten (Hard Drop) sperrt den Stein dagegen sofort.

Während einer laufenden Partie wird das Scrollen per Touch deaktiviert, damit Wischgesten auf der gesamten Seite zuverlässig als Steuerung erkannt werden. Es gibt keine separate Steuerungsleiste.

## Tastatur

- Pfeile links/rechts: verschieben
- Pfeil nach unten: Soft Drop
- Pfeil nach oben oder X: im Uhrzeigersinn drehen
- Z: gegen den Uhrzeigersinn drehen
- Leertaste: Hard Drop
- C: Hold
- P oder Escape: Pause
- M: Sound ein/aus

## Funktionen

- 10 × 20 Spielfeld, alle sieben Tetrominoformen, 7-Bag-Verteilung
- Wall Kicks beim Drehen (SRS) und Ghost-Piece
- Hold und Vorschau der nächsten Steine
- Punkte, Level, gelöschte Linien und lokal gespeicherter Rekord
- Animierte Linienlöschung, Partikel, Drop-Spuren und dezente Screen-Shakes
- Sounds aus der Web Audio API, ohne Sound-Dateien
- Automatische Pause beim Wechseln zu einem anderen Tab
- Offline-Caching mittels Service Worker und installierbares PWA-Manifest
- Berücksichtigt `prefers-reduced-motion`

## Projektdateien

- `index.html` – Spieloberfläche
- `styles.css` – responsives Dark-Mode-Design
- `game.js` – Spiellogik, Touch-Steuerung, Animation und Audio
- `manifest.webmanifest` – PWA-Konfiguration
- `sw.js` – Offline-Service-Worker
- `icons/` – Icons für Browser und Installation

Der Spielstand wird nicht auf einen Server übertragen. Rekord und Sound-Einstellung werden lokal per `localStorage` gespeichert.
