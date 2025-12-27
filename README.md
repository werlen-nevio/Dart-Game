# 🎯 Dart Online

Eine simple Echtzeit-Webapp für Dart-Spiele (X01: 301 & 501) mit Freunden.

## Features

- **Einfacher Login** (nur Username, kein Passwort)
- **Party erstellen & beitreten** via 6-stelligem Code
- **Echtzeit-Synchronisation** aller Spieler via Socket.IO
- **X01 Spielmodi** (301 & 501)
- **Single/Double Out**
- **Mobile-friendly** Button-Interface
- **Undo-Funktion**
- **Reconnect** (Party-State bleibt erhalten)

## Quick Start

### Option 1: Docker (Empfohlen)

Alles auf einen Schlag starten:

```bash
docker-compose up --build
```

Das wars! Die App läuft jetzt:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3000

Zum Beenden:
```bash
docker-compose down
```

### Option 2: Manuell

#### 1. Dependencies installieren

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

#### 2. Backend starten

```bash
cd backend
npm run dev
```

Server läuft auf: `http://localhost:3000`

#### 3. Frontend starten

```bash
cd frontend
npm run dev
```

Frontend läuft auf: `http://localhost:5173`

### Spielen

1. Öffne `http://localhost:5173` im Browser
2. Gib einen Username ein und klicke "Login"
3. Erstelle eine Party oder trete einer bei (mit Code)
4. Spiele Dart!

## Tech Stack

- **Frontend:** Vue 3 + Vite
- **Backend:** Node.js + Express + Socket.IO
- **Database:** In-Memory (Map) – kein Persist, aber Reconnect funktioniert

## Socket.IO Events

### Client → Server

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `user:login` | `username` (String) | User einloggen |
| `party:create` | `{ partyName, mode, outMode }` | Party erstellen |
| `party:join` | `code` (String) | Party beitreten |
| `game:add_throw` | `value` (Number) | Punkte zu aktuellem Wurf hinzufügen |
| `game:clear_throw` | - | Aktuellen Wurf zurücksetzen |
| `game:submit_throw` | `{ doubleHit }` (Boolean) | Wurf bestätigen & Score abziehen |
| `game:next_player` | - | Nächster Spieler ist dran |
| `game:undo` | - | Letzten Wurf rückgängig machen |

### Server → Client

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `user:logged_in` | `{ username }` | Login bestätigt |
| `party:created` | `party` (Object) | Party erstellt |
| `party:joined` | `party` (Object) | Party beigetreten |
| `party:state` | `party` (Object) | Aktueller Party-State (Broadcast) |
| `game:bust` | `message` (String) | Bust-Fehler (Score < 0) |
| `game:double_required` | `message` (String) | Double-Out nicht getroffen |
| `game:winner` | `username` (String) | Spieler hat gewonnen |
| `error` | `message` (String) | Allgemeiner Fehler |

### Party Object Struktur

```javascript
{
  code: String,           // 6-stelliger Party-Code
  name: String,           // Party-Name
  mode: String,           // "301" oder "501"
  outMode: String,        // "single" oder "double"
  players: [              // Array aller Spieler
    {
      username: String,
      score: Number,
      socketId: String
    }
  ],
  currentPlayerIndex: Number,  // Index des aktuellen Spielers
  currentThrow: Number,        // Aktueller Wurf (nicht submitted)
  history: [                   // Wurf-Historie
    {
      player: String,
      throw: Number,
      newScore: Number,
      timestamp: Number
    }
  ]
}
```

## Spielregeln

### Punkteeingabe

- **Buttons:** 1, 5, 10, 20, 25, 50, 60, 100, 140, 180
- Buttons addieren zum aktuellen Wurf
- **Clear:** Setzt aktuellen Wurf zurück
- **Submit:** Zieht Punkte ab und speichert Wurf
- **Next Player:** Wechselt zum nächsten Spieler
- **Undo:** Macht letzten Wurf rückgängig

### Bust & Win

- **Bust:** Wenn Score < 0 werden würde → Wurf wird nicht gespeichert
- **Win:** Exakt 0 Punkte
- **Double-Out:** Bei exakt 0 erscheint Modal "Double getroffen?" → Nur bei "Ja" wird Win gespeichert
- **Single-Out:** Exakt 0 reicht für Win

### Reconnect

- Bei Disconnect: User bleibt in Party (socketId wird nicht gelöscht)
- Bei Reconnect: User kann mit gleichem Username wieder joinen → socketId wird aktualisiert
- Party-State bleibt vollständig erhalten (solange Server läuft)

## Projekt-Struktur

```
dart-game/
├── backend/
│   ├── package.json
│   └── server.js          # Express + Socket.IO Server
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── style.css
│       └── App.vue        # Main Vue Component
└── README.md
```

## Erweiterungen (Optional)

Falls du später mehr willst:

- **Persistenz:** SQLite + Prisma einbauen (Party-State speichern)
- **Stats:** Durchschnittswurf, Checkout-Quote, etc.
- **Weitere Modi:** Cricket, Around the Clock
- **Auth:** Echtes Login mit Passwort
- **Deployment:** Railway, Render, Vercel

## Lizenz

MIT – Viel Spaß beim Dart spielen! 🎯
