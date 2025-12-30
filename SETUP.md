# Dart Game - Setup Anleitung

## 1. Backend Setup

### MongoDB installieren/starten

**Option A: Lokale MongoDB**
- Download: https://www.mongodb.com/try/download/community
- Nach Installation starten: `mongod`

**Option B: MongoDB Atlas (Cloud - Empfohlen)**
1. Account erstellen: https://www.mongodb.com/cloud/atlas/register
2. Kostenloses Cluster erstellen
3. Connection String kopieren

### Environment Variables einrichten

1. Kopiere `.env.example` zu `.env`:
```bash
cd backend
copy .env.example .env
```

2. Bearbeite `.env` und füge deine Werte ein:
```env
MONGODB_URI=mongodb://localhost:27017/dart-game
# ODER für MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dart-game

GOOGLE_CLIENT_ID=deine_google_client_id
GOOGLE_CLIENT_SECRET=dein_google_client_secret

SESSION_SECRET=ein_zufälliger_geheimer_schlüssel

CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3000
```

### Google OAuth Credentials

Da du die Google OAuth Credentials bereits hast:

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Wähle dein Projekt aus
3. Gehe zu "APIs & Services" > "Credentials"
4. Füge zu "Authorized redirect URIs" hinzu:
   - `http://localhost:3000/auth/google/callback`
5. Kopiere Client ID und Client Secret in deine `.env`

## 2. Backend starten

```bash
cd backend
npm install  # (bereits gemacht)
npm start
```

## 3. Frontend starten

```bash
cd frontend
npm run dev
```

## Features

✅ Google OAuth Login
✅ User in MongoDB speichern
✅ Profilbild Upload (lokal im uploads/ Ordner)
✅ Alle bisherigen Dart-Game Features

## API Endpoints

- `GET /auth/google` - Google Login starten
- `GET /auth/google/callback` - OAuth Callback
- `POST /auth/logout` - Logout
- `GET /auth/user` - Aktuellen User abrufen
- `POST /api/upload-profile-picture` - Profilbild hochladen

## Nächste Schritte

Das Frontend muss noch aktualisiert werden um:
- Google Login Button zu zeigen
- Profilbild Upload UI anzuzeigen
- User Profile anzuzeigen
