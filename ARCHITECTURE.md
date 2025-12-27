# Architecture Documentation

## System Overview

Dart Party ist eine Full-Stack Multiplayer Webapp mit Echtzeit-Synchronisation. Die Architektur folgt einer klaren Client-Server Trennung mit autoritativem Server.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │ Vue Router │  │   Pinia    │  │   Socket.IO Client     ││
│  │  (Routes)  │  │  (State)   │  │   (Real-time)          ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
│         │              │                      │              │
│         └──────────────┴──────────────────────┘              │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         │ HTTP/WS
                         │
┌────────────────────────┼─────────────────────────────────────┐
│                        │           Server                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express (REST API) + Socket.IO (WebSocket Server)    │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                              │                     │
│  ┌──────▼──────┐              ┌────────▼─────────┐          │
│  │   Auth      │              │  Party & Game    │          │
│  │  Service    │              │    Services      │          │
│  └──────┬──────┘              └────────┬─────────┘          │
│         │                              │                     │
│         └──────────────┬───────────────┘                     │
│                        │                                     │
│                 ┌──────▼──────┐                              │
│                 │   Prisma    │                              │
│                 │    (ORM)    │                              │
│                 └──────┬──────┘                              │
│                        │                                     │
│                 ┌──────▼──────┐                              │
│                 │   SQLite    │                              │
│                 │  Database   │                              │
│                 └─────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### 1. Registration

```
Client                          Server                    Database
  │                              │                           │
  │─── POST /api/auth/register ──▶│                          │
  │    {email, username, pwd}    │                           │
  │                              │                           │
  │                              │── Validate Input ────────│
  │                              │                           │
  │                              │── Hash Password (bcrypt)─│
  │                              │                           │
  │                              │── INSERT User ───────────▶│
  │                              │                           │
  │◀─── 201 Created ─────────────│                           │
  │    {user: UserDTO}           │                           │
```

### 2. Login

```
Client                          Server                    Database
  │                              │                           │
  │─── POST /api/auth/login ─────▶│                          │
  │    {email, password}         │                           │
  │                              │                           │
  │                              │── Find User ──────────────▶│
  │                              │                           │
  │                              │── Verify Password ────────│
  │                              │   (bcrypt.compare)        │
  │                              │                           │
  │                              │── Generate Access Token ──│
  │                              │   (JWT, 15min)            │
  │                              │                           │
  │                              │── Generate Refresh Token ─│
  │                              │   (JWT, 7 days)           │
  │                              │                           │
  │                              │── Store Refresh Token ────▶│
  │                              │                           │
  │◀─── 200 OK ──────────────────│                           │
  │    {user, accessToken}       │                           │
  │    Set-Cookie: refreshToken  │                           │
  │                              │                           │
  │── Store accessToken in ──────│                           │
  │   localStorage               │                           │
  │                              │                           │
  │── Connect Socket.IO ─────────▶│                          │
  │   auth: {token}              │                           │
```

### 3. Token Refresh

```
Client                          Server                    Database
  │                              │                           │
  │─── POST /api/auth/refresh ───▶│                          │
  │    Cookie: refreshToken      │                           │
  │                              │                           │
  │                              │── Verify Refresh Token ───│
  │                              │                           │
  │                              │── Check DB ───────────────▶│
  │                              │                           │
  │                              │── Delete Old Token ───────▶│
  │                              │                           │
  │                              │── Generate New Tokens ────│
  │                              │                           │
  │                              │── Store New Refresh ──────▶│
  │                              │                           │
  │◀─── 200 OK ──────────────────│                           │
  │    {accessToken}             │                           │
  │    Set-Cookie: new refresh   │                           │
```

## Party & Game State Flow

### Party Creation & Join

```
User A (Host)                Server                   User B (Joiner)
     │                         │                            │
     │── party:create ─────────▶│                           │
     │                          │                            │
     │                          │── Generate unique code ───│
     │                          │   (6-char alphanumeric)   │
     │                          │                            │
     │                          │── Create Party in DB ─────│
     │                          │                            │
     │                          │── Create GameState ───────│
     │                          │   (status: waiting)       │
     │                          │                            │
     │◀── PartyDTO ─────────────│                           │
     │   {code: "ABC123"}       │                            │
     │                          │                            │
     │                          │                            │
     │      [User A shares code "ABC123" with User B]       │
     │                          │                            │
     │                          │◀── party:join ────────────│
     │                          │   {code: "ABC123"}        │
     │                          │                            │
     │                          │── Find Party ─────────────│
     │                          │                            │
     │                          │── Add Member ─────────────│
     │                          │                            │
     │◀── party:member_joined ──│── PartyStateDTO ─────────▶│
     │   {username: "User B"}   │                            │
```

### Game Start & Turn Flow

```
Host                    Server                   Player 1      Player 2
 │                        │                          │            │
 │── game:start ─────────▶│                         │            │
 │                        │                          │            │
 │                        │── Initialize GameState ─│            │
 │                        │   scores: {p1:501,p2:501}│           │
 │                        │   turnIndex: 0           │            │
 │                        │   playerOrder: [p1, p2]  │            │
 │                        │                          │            │
 │◀── game:state_updated ─│──────────────────────────▶──────────▶│
 │                        │                          │            │
 │                        │◀── game:score_entry ─────│            │
 │                        │   {points: 60}           │            │
 │                        │                          │            │
 │                        │── Validate: ─────────────│            │
 │                        │   - Is it player's turn? │            │
 │                        │   - Valid points?        │            │
 │                        │   - Bust check           │            │
 │                        │                          │            │
 │                        │── Update Score: ─────────│            │
 │                        │   p1: 501 -> 441         │            │
 │                        │                          │            │
 │◀── game:state_updated ─│──────────────────────────▶──────────▶│
 │◀── game:action_logged ─│──────────────────────────▶──────────▶│
 │                        │                          │            │
 │                        │◀── game:turn_end ────────│            │
 │                        │                          │            │
 │                        │── Advance Turn: ─────────│            │
 │                        │   turnIndex: 0 -> 1      │            │
 │                        │                          │            │
 │◀── game:state_updated ─│──────────────────────────▶──────────▶│
 │   (now Player 2's turn)│                          │            │
```

### Checkout Flow (Double-Out)

```
Player                    Server                   All Clients
  │                         │                            │
  │── game:score_entry ─────▶│                           │
  │   {points: 50}          │                            │
  │   (current score: 50)   │                            │
  │                         │                            │
  │                         │── Validate: ──────────────│
  │                         │   newScore = 50 - 50 = 0  │
  │                         │   outRule = 'double'      │
  │                         │   → Needs confirmation    │
  │                         │                            │
  │◀── Error ───────────────│                           │
  │   'CHECKOUT_CONFIRM_    │                            │
  │    REQUIRED'            │                            │
  │                         │                            │
  │── [Show Modal] ─────────│                           │
  │   "War letzter Dart     │                            │
  │    ein Double?"         │                            │
  │                         │                            │
  │── game:checkout_confirm ▶│                           │
  │   {points: 50,          │                            │
  │    isDouble: true}      │                            │
  │                         │                            │
  │                         │── Validate Checkout: ─────│
  │                         │   - Score = 0?            │
  │                         │   - isDouble = true?      │
  │                         │                            │
  │                         │── Apply Score ────────────│
  │                         │── Set Winner ─────────────│
  │                         │── Status: finished ───────│
  │                         │                            │
  │                         │── game:state_updated ─────▶│
  │                         │── game:finished ──────────▶│
  │                         │   {winnerId, winnerName}   │
```

## Data Models

### Database Schema (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  partyMembers   PartyMember[]
  createdParties Party[]       @relation("PartyHost")
  refreshTokens  RefreshToken[]
}

model Party {
  id       String   @id @default(uuid())
  code     String   @unique  // 6-char alphanumeric
  name     String
  hostId   String
  isPublic Boolean  @default(false)
  status   String   @default("waiting") // waiting | playing | finished

  host       User          @relation("PartyHost")
  members    PartyMember[]
  gameState  GameState?
  actionLogs ActionLog[]
}

model GameState {
  id          String @id @default(uuid())
  partyId     String @unique
  mode        String // "X01"
  settings    String // JSON: {startScore, outRule}
  scores      String // JSON: {[userId]: {score, history}}
  turnIndex   Int    @default(0)
  playerOrder String // JSON: [userId1, userId2, ...]
  status      String @default("playing") // playing | finished
  winnerId    String?
}

model ActionLog {
  id         String   @id @default(uuid())
  partyId    String
  userId     String
  actionType String   // score_entry | undo | turn_end | etc.
  actionData String   // JSON payload
  timestamp  DateTime @default(now())
}
```

### State Model (Frontend)

```typescript
interface PartyState {
  party: PartyDTO | null
  members: PartyMemberDTO[]
  gameState: GameStateDTO | null
  recentActions: ActionLogDTO[]
}

interface GameStateDTO {
  mode: 'X01'
  settings: GameSettings
  scores: Record<string, PlayerScore>
  turnIndex: number
  playerOrder: string[]
  status: 'playing' | 'finished'
  winnerId: string | null
}

interface PlayerScore {
  score: number
  history: number[]  // All throws
}
```

## Socket.IO Events Reference

### Client → Server Events

| Event | Payload | Response | Description |
|-------|---------|----------|-------------|
| `party:create` | `{name, isPublic, mode, settings}` | `{success, data?: PartyDTO, error?}` | Party erstellen |
| `party:join` | `{code}` | `{success, data?: PartyStateDTO, error?}` | Party beitreten |
| `party:leave` | - | `{success, error?}` | Party verlassen |
| `party:kick` | `{userId}` | `{success, error?}` | Spieler kicken (Host) |
| `party:close` | - | `{success, error?}` | Party schließen (Host) |
| `game:start` | - | `{success, error?}` | Spiel starten (Host) |
| `game:reset` | - | `{success, error?}` | Spiel zurücksetzen (Host) |
| `game:score_entry` | `{points, actionId}` | `{success, error?}` | Punkte eintragen |
| `game:checkout_confirm` | `{points, isDouble, actionId}` | `{success, error?}` | Checkout bestätigen |
| `game:undo` | - | `{success, error?}` | Letzte Aktion rückgängig |
| `game:turn_end` | - | `{success, error?}` | Zug beenden |
| `game:set_player_order` | `{playerOrder}` | `{success, error?}` | Reihenfolge setzen (Host) |
| `game:randomize_order` | - | `{success, error?}` | Reihenfolge mischen (Host) |
| `party:get_state` | - | `{success, data?: PartyStateDTO, error?}` | State abrufen |

### Server → Client Events (Broadcasts)

| Event | Payload | Trigger | Description |
|-------|---------|---------|-------------|
| `party:updated` | `PartyDTO` | Party-Änderung | Party wurde aktualisiert |
| `party:member_joined` | `PartyMemberDTO` | Spieler joined | Neuer Spieler |
| `party:member_left` | `{userId}` | Spieler left | Spieler hat verlassen |
| `party:member_status` | `{userId, isOnline}` | Status-Änderung | Online-Status |
| `party:closed` | - | Host schließt | Party geschlossen |
| `party:kicked` | - | Kick-Aktion | Du wurdest gekickt |
| `game:state_updated` | `GameStateDTO` | Jede Game-Action | Spielstand aktualisiert |
| `game:action_logged` | `ActionLogDTO` | Jede Game-Action | Neue Aktion geloggt |
| `game:finished` | `{winnerId, winnerName}` | Win-Condition | Spiel beendet |
| `party:full_state` | `PartyStateDTO` | Reset, Reconnect | Kompletter State |
| `error` | `{message}` | Error | Fehler |
| `notification` | `{type, message}` | Info | Notification |

## Security Considerations

### Authentication Security

1. **Password Storage**: bcrypt mit Salt-Rounds = 10
2. **Token Management**:
   - Access Token: Short-lived (15min), localStorage
   - Refresh Token: Long-lived (7 days), httpOnly Cookie
3. **Token Rotation**: Bei jedem Refresh werden neue Tokens generiert

### Authorization

- **Socket.IO Authentication**: Middleware prüft Access Token bei Verbindung
- **Host-Only Actions**: Server prüft `party.hostId === user.id`
- **Turn Validation**: Server prüft `currentPlayer === requesting user`

### Input Validation

```typescript
// Zod Schema Beispiel
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(6),
})
```

### Rate Limiting

- Auth Endpoints: 100 Requests / 15 Minuten
- Configured via `express-rate-limit`

### CORS

- Konfigurierbar via `CORS_ORIGIN` Environment Variable
- Credentials: true (für Cookies)

## Scalability Considerations

### Current Architecture Limits

- **SQLite**: File-based, nicht für hohe Konkurrenz
- **In-Memory Action Deduplication**: Nicht persistent
- **Single Server**: Keine horizontale Skalierung

### Future Improvements

1. **Database**: Migration zu PostgreSQL/MySQL
2. **Caching**: Redis für Session-Storage und Action IDs
3. **Load Balancing**: Sticky Sessions für Socket.IO
4. **Message Queue**: Für Event Processing
5. **CDN**: Für Static Assets

## Error Handling

### Backend Error Flow

```typescript
try {
  // Business Logic
  await partyService.createParty(...)
} catch (error: any) {
  logger.error('Error message', { error: error.message })
  callback({ success: false, error: error.message })
}
```

### Frontend Error Flow

```typescript
try {
  await partyStore.createParty(...)
  toastStore.success('Success!')
} catch (err: any) {
  toastStore.error(err.message || 'Unknown error')
}
```

## Logging Strategy

### Backend Logging

```typescript
logger.info('User connected', { userId, username })
logger.warn('Invalid action attempt', { userId, action })
logger.error('Database error', { error: err.message, stack: err.stack })
```

### Log Levels

- **info**: Normal operations (connections, actions)
- **warn**: Suspicious activity, validation failures
- **error**: Exceptions, crashes
- **debug**: Detailed tracing (development only)

## Testing Strategy

### Backend Unit Tests

- **Game Service**: X01 Validation Logic
- **Auth Service**: Token generation, password hashing
- **Party Service**: State management

### Integration Tests (Future)

- REST API Endpoints
- Socket.IO Event Handlers
- Database Operations

### E2E Tests (Future)

- User Registration → Party Creation → Game Play → Win
- Multi-player scenarios
- Disconnect/Reconnect

## Deployment Architecture

### Development

```
localhost:5173 (Vite Dev Server) ──┐
                                   ├─→ localhost:3001 (Backend)
localhost:5173/api (Proxy) ────────┘
```

### Docker Production

```
nginx:80 ──┐
           ├─→ backend:3001 (Express + Socket.IO)
           │                    │
           │                    └─→ SQLite Volume
           │
           └─→ Static Files (Vue Build)
```

## Performance Optimizations

### Frontend

1. **Code Splitting**: Route-based lazy loading
2. **State Management**: Pinia for reactive updates
3. **WebSocket**: Persistent connection, no polling
4. **Tailwind CSS**: PurgeCSS in production

### Backend

1. **Prisma**: Efficient queries with ORM
2. **Action Deduplication**: In-memory Set for 10s TTL
3. **JSON Storage**: Embedded JSON for flexible schemas
4. **Connection Pooling**: Prisma manages connections

## Monitoring & Observability

### Recommended Tools (Future)

- **Application Monitoring**: Sentry, New Relic
- **Logging**: Winston, Pino
- **Metrics**: Prometheus + Grafana
- **Uptime**: UptimeRobot, Pingdom

---

**Last Updated**: 2025-12-27
