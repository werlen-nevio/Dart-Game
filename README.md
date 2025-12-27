# 🎯 Dart Party - Multiplayer Dart Game

Eine produktionsnahe Webapp für Online-Multiplayer-Dart. Freunde können von zuhause aus gemeinsam in einer Party spielen, Ergebnisse in Echtzeit eingeben und X01 (301/501) mit Single-Out oder Double-Out Regeln spielen.

## Features

### ✨ Funktionen
- **Multiplayer Lobby System**: Erstelle oder trete Parties bei (2 bis ∞ Spieler)
- **Live Presence**: Echtzeit-Anzeige aller Spieler und deren Status
- **X01 Game Modes**: 301 und 501 mit Single-Out oder Double-Out
- **Turn-Based Gameplay**: Klare Zugreihenfolge mit automatischem Wechsel
- **Validierung**: Serverseitige Bust-Erkennung, Double-Out Checkout-Bestätigung
- **Undo Funktion**: Letzte Aktion rückgängig machen (für alle synchron)
- **Action History**: Letzte 20 Aktionen mit Timestamps
- **Host Controls**: Spieler kicken, Reihenfolge ändern, Spiel resetten
- **Mobile-First UI**: Optimiert für Touch-Bedienung

### 🔐 Authentication
- Email + Passwort Registration/Login
- JWT Access Token (15min) + Refresh Token (7 Tage, httpOnly Cookie)
- Route Guards für geschützte Bereiche
- Automatisches Token Refresh

### 🎮 Spielablauf
1. **Party erstellen**: Name, Startscore (301/501), Out-Regel wählen
2. **Freunde einladen**: 6-stelligen Party-Code teilen
3. **Lobby**: Alle Spieler sehen sich live, Host startet das Spiel
4. **Spielen**: Punkteeingabe über Buttons, Checkout-Bestätigung bei Double-Out
5. **Gewinner**: Automatische Erkennung bei exakt 0 Punkten

## Tech Stack

### Backend
- **Node.js + Express**: REST API
- **Socket.IO**: Echtzeit-Kommunikation
- **Prisma + SQLite**: Datenbank ORM
- **TypeScript**: Type-Safety
- **bcrypt**: Passwort-Hashing
- **jsonwebtoken**: Auth
- **zod**: Input Validation
- **Jest**: Unit Tests

### Frontend
- **Vue 3 (Composition API)**: Framework
- **Vite**: Build Tool
- **TypeScript**: Type-Safety
- **Tailwind CSS**: Styling
- **Pinia**: State Management
- **Vue Router**: Routing
- **Axios**: HTTP Client
- **Socket.IO Client**: WebSocket

### DevOps
- **Docker + Docker Compose**: Containerization
- **Nginx**: Frontend Proxy
- **Multi-stage builds**: Optimierte Images

## 🚀 Getting Started

### Voraussetzungen
- Node.js 20+
- npm oder yarn
- (Optional) Docker & Docker Compose

### Lokale Entwicklung

#### Backend starten

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

Backend läuft auf: `http://localhost:3001`

#### Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf: `http://localhost:5173`

### Docker Deployment

```bash
# .env Datei erstellen (kopiere .env.example)
cp .env.example .env

# WICHTIG: Ändere die JWT Secrets in .env!

# Container bauen und starten
docker-compose up --build

# Im Hintergrund:
docker-compose up -d
```

App läuft auf: `http://localhost`

### Stoppen

```bash
docker-compose down

# Mit Daten löschen:
docker-compose down -v
```

## 📁 Projektstruktur

```
dart-game/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Datenbank Schema
│   ├── src/
│   │   ├── config/                # Konfiguration
│   │   ├── middleware/            # Auth & Validation
│   │   ├── routes/                # REST API Routes
│   │   ├── services/              # Business Logic
│   │   │   ├── auth.service.ts    # Authentication
│   │   │   ├── game.service.ts    # X01 Validation
│   │   │   └── party.service.ts   # Party Management
│   │   ├── socket/                # Socket.IO Handler
│   │   ├── types/                 # TypeScript Types
│   │   ├── utils/                 # Helper Functions
│   │   └── index.ts               # Server Entry
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Vue Components
│   │   ├── router/                # Vue Router + Guards
│   │   ├── services/              # API & Socket Services
│   │   ├── stores/                # Pinia Stores
│   │   ├── types/                 # TypeScript Types
│   │   ├── views/                 # Page Components
│   │   │   ├── Login.vue
│   │   │   ├── Register.vue
│   │   │   ├── Dashboard.vue
│   │   │   └── Party.vue          # Haupt-Spielansicht
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── style.css
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔧 Konfiguration

### Backend Environment Variables

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_ACCESS_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-secret-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
```

### Frontend Configuration

Frontend-Konfiguration ist in `vite.config.ts`:
- API Proxy: `/api` → `http://localhost:3001`
- Port: `5173`

## 📡 API Dokumentation

### REST API Endpoints

#### Authentication

**POST** `/api/auth/register`
```json
{
  "email": "user@example.com",
  "username": "player1",
  "password": "secure123"
}
```

**POST** `/api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "secure123"
}
```

**POST** `/api/auth/logout`
- No body required

**POST** `/api/auth/refresh`
- Uses httpOnly cookie

**GET** `/api/auth/me`
- Requires Bearer token

### Socket.IO Events

Siehe ARCHITECTURE.md für vollständige Dokumentation.

#### Client → Server Events

```typescript
'party:create'          // Party erstellen
'party:join'            // Party beitreten
'party:leave'           // Party verlassen
'party:kick'            // Spieler kicken (Host only)
'party:close'           // Party schließen (Host only)

'game:start'            // Spiel starten (Host only)
'game:reset'            // Spiel zurücksetzen (Host only)
'game:score_entry'      // Punkte eintragen
'game:checkout_confirm' // Checkout bestätigen
'game:undo'             // Letzte Aktion rückgängig
'game:turn_end'         // Zug beenden
'game:randomize_order'  // Reihenfolge mischen (Host only)

'party:get_state'       // Aktuellen State abrufen
```

#### Server → Client Events

```typescript
'party:updated'         // Party wurde aktualisiert
'party:member_joined'   // Spieler ist beigetreten
'party:member_left'     // Spieler hat verlassen
'party:member_status'   // Online-Status geändert
'party:closed'          // Party wurde geschlossen
'party:kicked'          // Du wurdest gekickt

'game:state_updated'    // Spielstand aktualisiert
'game:action_logged'    // Neue Aktion geloggt
'game:finished'         // Spiel beendet
'party:full_state'      // Kompletter State Sync

'error'                 // Fehler
'notification'          // Info/Warning/Success
```

## 🎮 X01 Spielregeln & Validierung

### Startscore
- **301**: Kürzeres Spiel
- **501**: Standard Turnier-Format

### Out-Regeln

#### Single-Out
- Jeder Wurf zählt zum Auschecken
- Score muss exakt 0 erreichen
- **Bust**: Score < 0

#### Double-Out
- Letzter Wurf muss ein Double sein
- Score muss exakt 0 erreichen mit Double
- **Bust**: Score < 0 ODER Score = 1 (nicht mit Double auszuchecken)
- **Checkout-Bestätigung**: Bei Score = 0 muss Spieler bestätigen, ob letzter Dart ein Double war

### Serverseitige Validierung

Alle Regeln werden autoritativ auf dem Server validiert:

```typescript
// Bust Detection
if (newScore < 0) return 'Bust! Score cannot go below 0'

// Double-Out: Score 1 unmöglich
if (newScore === 1 && outRule === 'double')
  return 'Bust! Cannot end on 1 with Double-Out'

// Double-Out: Checkout Confirmation
if (newScore === 0 && outRule === 'double')
  // Modal: "War letzter Dart ein Double?"
```

### Undo Mechanik

- Letzte Aktion wird rückgängig gemacht
- Funktioniert für: Score Entry, Checkout, Turn End
- Stellt Score UND Turn-Status wieder her
- Synchron für alle Clients
- Bei Win-Undo: Status wird auf "playing" zurückgesetzt

## 🧪 Tests

Backend Unit Tests für X01 Validation:

```bash
cd backend
npm test
```

Tests abgedeckt:
- ✅ Valid score entry (Single-Out)
- ✅ Bust detection (score < 0)
- ✅ Exact checkout to 0 (Single-Out)
- ✅ Score = 1 allowed (Single-Out)
- ✅ Checkout confirmation required (Double-Out)
- ✅ Score = 1 rejection (Double-Out)
- ✅ Valid/Invalid double checkout
- ✅ Score application & winner detection
- ✅ Undo functionality
- ✅ Turn advancement

## 🔒 Security

### Implementierte Security Maßnahmen

1. **Password Hashing**: bcrypt mit 10 Runden
2. **JWT Tokens**:
   - Access Token (short-lived, 15min)
   - Refresh Token (httpOnly Cookie, 7 Tage)
3. **Rate Limiting**: 100 Requests/15min für Auth-Endpoints
4. **CORS**: Konfigurierbare Origins
5. **Input Validation**: Zod schemas für alle Inputs
6. **SQL Injection**: Geschützt durch Prisma ORM
7. **XSS**: Vue escapet automatisch
8. **CSRF**: SameSite Cookies

### Production Checklist

- [ ] JWT Secrets ändern (min. 32 Zeichen)
- [ ] HTTPS aktivieren
- [ ] `NODE_ENV=production` setzen
- [ ] Database Backups einrichten
- [ ] Rate Limits anpassen
- [ ] Logging/Monitoring einrichten
- [ ] CORS Origin auf Production Domain setzen

## 🎨 UI/UX Features

- **Mobile-First**: Buttons groß genug für Touch
- **Live Updates**: Echtzeit ohne Reload
- **Toast Notifications**: Feedback für alle Aktionen
- **Loading States**: Disabled Buttons während Requests
- **Error Handling**: User-freundliche Fehlermeldungen
- **Responsive Design**: Funktioniert auf Phone, Tablet, Desktop
- **Copy-to-Clipboard**: Einfaches Teilen des Party-Codes
- **Visual Turn Indicator**: Aktueller Spieler ist highlighted
- **Action History**: Letzten 20 Aktionen mit Timestamps

## 🚧 Zukünftige Features (Erweiterbar)

Die Architektur ist vorbereitet für:

- **Weitere Spielmodi**: Cricket, Around the Clock
- **Double-In Regel**: Toggle für X01
- **Admin Mode**: Jeder kann für jeden eintragen
- **Statistics**: Player Stats, Averages, Checkout-Quote
- **Achievements**: Badges für 180er, High-Checkout, etc.
- **Voice Chat**: Integration per WebRTC
- **Replays**: Spiele nachschauen
- **Tournaments**: Bracket-System
- **Teams**: 2v2 Matches

## 🐛 Troubleshooting

### Backend startet nicht

```bash
# Prisma Client neu generieren
npx prisma generate

# Migrations anwenden
npx prisma migrate dev
```

### Frontend kann nicht mit Backend verbinden

- Prüfe ob Backend läuft (`http://localhost:3001/api/health`)
- Prüfe CORS Settings in `backend/.env`
- Prüfe Socket.IO URL in `frontend/src/services/socket.service.ts`

### Socket.IO Verbindung schlägt fehl

- Prüfe Access Token in localStorage
- Prüfe Browser Console für Errors
- Prüfe Backend Logs

### Docker Container starten nicht

```bash
# Logs anschauen
docker-compose logs backend
docker-compose logs frontend

# Container neu bauen
docker-compose up --build --force-recreate
```

## 📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte.

## 🤝 Entwickler

Entwickelt als produktionsnahes MVP für Online-Multiplayer-Dart.

Bei Fragen oder Issues: GitHub Issues öffnen!

---

**Happy Darting! 🎯**