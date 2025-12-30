# 🎯 Dart Game

Ein modernes Dart-Spiel mit 301/501 Modi, Google OAuth Login, Profilbildern und Real-time Multiplayer.

## Features

✅ **Authentifizierung**
- Google OAuth Login
- User-Profile in MongoDB
- Profilbild Upload

✅ **Dart Game**
- 301 / 501 Modi
- Single Out / Double Out
- Real-time Multiplayer mit Socket.IO
- Interaktives Dartboard
- Click to remove shots
- Miss button
- Matte Black Design (#0f1415)

✅ **Technologie**
- Frontend: Vue 3 + Vite
- Backend: Node.js + Express + Socket.IO
- Database: MongoDB
- Auth: Passport.js (Google OAuth)
- Docker Support

## 🚀 Quick Start mit Docker

### 1. Google OAuth Credentials einrichten

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Aktiviere die "Google+ API"
4. Gehe zu "APIs & Services" > "Credentials"
5. Erstelle "OAuth 2.0 Client ID"
6. Füge zu "Authorized redirect URIs" hinzu:
   - `http://localhost:3000/auth/google/callback`
7. Kopiere Client ID und Client Secret

### 2. Environment Variables einrichten

```bash
# Kopiere .env.example zu .env
copy .env.example .env

# Bearbeite .env und füge deine Google OAuth Credentials ein
```

### 3. Mit Docker Compose starten

```bash
# Alles bauen und starten
docker-compose up --build

# Im Hintergrund starten
docker-compose up -d --build
```

Die App läuft jetzt auf:
- **Frontend**: http://localhost
- **Backend**: http://localhost:3000
- **MongoDB**: localhost:27017

### 4. Stoppen

```bash
# Stoppen
docker-compose down

# Stoppen und Volumes löschen (Datenbank wird gelöscht!)
docker-compose down -v
```

## 📦 Manuelle Installation (ohne Docker)

### Prerequisites

- Node.js 20+
- MongoDB (lokal oder MongoDB Atlas)

### Backend Setup

```bash
cd backend
npm install

# Erstelle .env Datei (siehe backend/.env.example)
copy .env.example .env

# Starte MongoDB (wenn lokal)
mongod

# Starte Backend
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 🎮 Wie man spielt

1. Öffne http://localhost (oder http://localhost:5173 ohne Docker)
2. Login mit Google (optional: später kann man auch einfachen Username verwenden)
3. Erstelle eine Party oder trete einer bei
4. Wähle 301/501 und Single/Double Out
5. Klicke auf das Dartboard um Würfe einzugeben
6. Klicke auf einen Wurf um ihn zu entfernen
7. "Miss" Button für Fehlwürfe
8. "Next Player" um zum nächsten Spieler zu wechseln

## 🛠️ Entwicklung

### Backend Development
```bash
cd backend
npm run dev  # mit nodemon
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Docker Development Mode
```bash
# Backend und MongoDB starten
docker-compose up mongodb backend

# Frontend separat starten für Hot Reload
cd frontend
npm run dev
```

## 📁 Projekt Struktur

```
Dart-Game/
├── backend/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   └── passport.js       # Google OAuth config
│   ├── models/
│   │   └── User.js          # User model
│   ├── uploads/             # Uploaded profile pictures
│   ├── server.js           # Main server file
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.vue         # Main component
│   │   ├── style.css       # Matte black styles
│   │   └── main.js
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔧 Environment Variables

Siehe `.env.example` für alle verfügbaren Optionen.

**Wichtig:**
- `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` sind ERFORDERLICH
- `SESSION_SECRET` sollte ein sicherer, zufälliger String sein
- Für Production: Ändere MongoDB Credentials!

## 🌐 Production Deployment

1. Ändere MongoDB Credentials in `.env`
2. Setze sichere `SESSION_SECRET`
3. Update `CLIENT_URL` und `SERVER_URL` auf deine Domain
4. Füge deine Production URL zu Google OAuth redirect URIs hinzu
5. Deploy mit Docker Compose

## 📝 API Endpoints

- `GET /auth/google` - Google Login starten
- `GET /auth/google/callback` - OAuth Callback
- `POST /auth/logout` - Logout
- `GET /auth/user` - Aktuellen User abrufen
- `POST /api/upload-profile-picture` - Profilbild hochladen

## 🎨 Design

- **Matte Black Theme**: #0f1415
- **Simple, beautiful, minimal design**
- **No glowy effects**
- **Clean white buttons**
- **Responsive**

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Stelle sicher dass MongoDB läuft
- Überprüfe `MONGODB_URI` in `.env`

**Google OAuth Error:**
- Überprüfe Client ID und Secret
- Stelle sicher dass redirect URI korrekt ist
- Aktiviere Google+ API in Google Cloud Console

**Docker Build Fehler:**
- Lösche alte Images: `docker-compose down -v`
- Rebuild: `docker-compose up --build`

## 📄 License

MIT
