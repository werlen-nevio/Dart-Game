import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// In-Memory Store
const parties = new Map(); // partyCode -> Party
const users = new Map();   // socketId -> { username, partyCode }

// Helper: Generate Party Code
function generatePartyCode() {
  let code;
  do {
    code = nanoid(6).toUpperCase();
  } while (parties.has(code));
  return code;
}

// Helper: Broadcast Party State
function broadcastPartyState(partyCode) {
  const party = parties.get(partyCode);
  if (!party) return;
  io.to(partyCode).emit('party:state', party);
}

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Login
  socket.on('user:login', (username) => {
    users.set(socket.id, { username, partyCode: null });
    socket.emit('user:logged_in', { username });
    console.log(`User logged in: ${username}`);
  });

  // Create Party
  socket.on('party:create', ({ partyName, mode, outMode }) => {
    const user = users.get(socket.id);
    if (!user) return socket.emit('error', 'Not logged in');

    const code = generatePartyCode();
    const startScore = mode === '301' ? 301 : 501;

    const party = {
      code,
      name: partyName,
      mode,
      outMode,
      players: [{
        username: user.username,
        score: startScore,
        socketId: socket.id
      }],
      currentPlayerIndex: 0,
      currentThrow: 0,
      history: []
    };

    parties.set(code, party);
    user.partyCode = code;
    socket.join(code);

    socket.emit('party:created', party);
    broadcastPartyState(code);
    console.log(`Party created: ${code} by ${user.username}`);
  });

  // Join Party
  socket.on('party:join', (code) => {
    const user = users.get(socket.id);
    if (!user) return socket.emit('error', 'Not logged in');

    const party = parties.get(code);
    if (!party) return socket.emit('error', 'Party not found');

    // Check if already in party
    const existing = party.players.find(p => p.username === user.username);
    if (!existing) {
      const startScore = party.mode === '301' ? 301 : 501;
      party.players.push({
        username: user.username,
        score: startScore,
        socketId: socket.id
      });
    } else {
      // Reconnect: update socketId
      existing.socketId = socket.id;
    }

    user.partyCode = code;
    socket.join(code);

    socket.emit('party:joined', party);
    broadcastPartyState(code);
    console.log(`${user.username} joined party ${code}`);
  });

  // Add to Current Throw
  socket.on('game:add_throw', (value) => {
    const user = users.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    party.currentThrow = (party.currentThrow || 0) + value;
    broadcastPartyState(user.partyCode);
  });

  // Clear Current Throw
  socket.on('game:clear_throw', () => {
    const user = users.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    party.currentThrow = 0;
    broadcastPartyState(user.partyCode);
  });

  // Submit Throw
  socket.on('game:submit_throw', ({ doubleHit }) => {
    const user = users.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    const currentPlayer = party.players[party.currentPlayerIndex];

    // Check if the user is the current player
    if (currentPlayer.username !== user.username) {
      socket.emit('error', 'Du bist nicht am Zug!');
      return;
    }
    const throwValue = party.currentThrow || 0;
    const newScore = currentPlayer.score - throwValue;

    // Bust check
    if (newScore < 0) {
      socket.emit('game:bust', 'Bust! Score would be negative.');
      party.currentThrow = 0;
      broadcastPartyState(user.partyCode);
      return;
    }

    // Win check
    if (newScore === 0) {
      if (party.outMode === 'double' && !doubleHit) {
        socket.emit('game:double_required', 'Double-Out required!');
        party.currentThrow = 0;
        broadcastPartyState(user.partyCode);
        return;
      }

      // Winner!
      currentPlayer.score = 0;
      party.currentThrow = 0;
      party.history.push({
        player: currentPlayer.username,
        throw: throwValue,
        newScore: 0,
        timestamp: Date.now()
      });
      io.to(user.partyCode).emit('game:winner', currentPlayer.username);
      broadcastPartyState(user.partyCode);
      return;
    }

    // Normal throw
    currentPlayer.score = newScore;
    party.history.push({
      player: currentPlayer.username,
      throw: throwValue,
      newScore,
      timestamp: Date.now()
    });
    party.currentThrow = 0;
    broadcastPartyState(user.partyCode);
  });

  // Next Player
  socket.on('game:next_player', () => {
    const user = users.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    const currentPlayer = party.players[party.currentPlayerIndex];

    // Check if the user is the current player
    if (currentPlayer.username !== user.username) {
      socket.emit('error', 'Du bist nicht am Zug!');
      return;
    }

    party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;
    party.currentThrow = 0;
    broadcastPartyState(user.partyCode);
  });

  // Undo Last Throw
  socket.on('game:undo', () => {
    const user = users.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party || party.history.length === 0) return;

    const lastEntry = party.history.pop();
    const player = party.players.find(p => p.username === lastEntry.player);
    if (player) {
      player.score = lastEntry.newScore + lastEntry.throw;
    }

    broadcastPartyState(user.partyCode);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    users.delete(socket.id);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
