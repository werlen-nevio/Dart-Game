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

// Helper: Handle Submit Throw
function handleSubmitThrow(partyCode) {
  const party = parties.get(partyCode);
  if (!party) return;

  const currentPlayer = party.players[party.currentPlayerIndex];
  const throwValue = party.currentShots.reduce((sum, s) => sum + s.value, 0);
  const newScore = currentPlayer.score - throwValue;

  // Note: Bust and win checks are already handled in game:add_throw
  // This function is only called for normal score updates after 3 shots

  // Normal throw
  currentPlayer.score = newScore;
  party.history.push({
    player: currentPlayer.username,
    shots: [...party.currentShots],
    throw: throwValue,
    newScore,
    timestamp: Date.now()
  });
  party.currentShots = [];

  // Auto-advance to next player
  party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;

  broadcastPartyState(partyCode);
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
      currentShots: [],
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
  socket.on('game:add_throw', (shotData) => {
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

    // Check if max shots reached
    if (party.currentShots.length >= 3) {
      socket.emit('error', 'Maximal 3 Würfe pro Runde!');
      return;
    }

    // Store shot with metadata
    const shot = {
      value: shotData.value,
      multiplier: shotData.multiplier,
      baseNumber: shotData.baseNumber
    };

    party.currentShots.push(shot);

    // Calculate current total
    const throwValue = party.currentShots.reduce((sum, s) => sum + s.value, 0);
    const newScore = currentPlayer.score - throwValue;

    // Bust check - end turn immediately
    if (newScore < 0) {
      socket.emit('game:bust', 'Bust! Score would be negative.');
      party.currentShots = [];
      party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;
      broadcastPartyState(user.partyCode);
      return;
    }

    // Double-out specific: Score of 1 is impossible to checkout
    if (party.outMode === 'double' && newScore === 1) {
      socket.emit('game:bust', 'Bust! Score of 1 cannot be checked out.');
      party.currentShots = [];
      party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;
      broadcastPartyState(user.partyCode);
      return;
    }

    // Win check - if exactly 0
    if (newScore === 0) {
      // Check if last dart was actually thrown on the double ring
      const lastShot = shot;
      const isDouble = lastShot.multiplier === 2;

      if (party.outMode === 'double') {
        // Double-out: must finish with a double
        if (isDouble) {
          // Valid double-out win
          currentPlayer.score = 0;
          party.history.push({
            player: currentPlayer.username,
            shots: [...party.currentShots],
            throw: throwValue,
            newScore: 0,
            timestamp: Date.now()
          });
          party.currentShots = [];
          io.to(user.partyCode).emit('game:winner', currentPlayer.username);
          broadcastPartyState(user.partyCode);
          return;
        } else {
          // Not a double - bust
          socket.emit('game:double_required', 'Double-Out required! Must finish with a double.');
          party.currentShots = [];
          party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;
          broadcastPartyState(user.partyCode);
          return;
        }
      } else {
        // Single out - immediate win
        currentPlayer.score = 0;
        party.history.push({
          player: currentPlayer.username,
          shots: [...party.currentShots],
          throw: throwValue,
          newScore: 0,
          timestamp: Date.now()
        });
        party.currentShots = [];
        io.to(user.partyCode).emit('game:winner', currentPlayer.username);
        broadcastPartyState(user.partyCode);
        return;
      }
    }

    broadcastPartyState(user.partyCode);
  });

  // Remove Shot
  socket.on('game:remove_shot', (index) => {
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

    // Remove shot at index
    if (index >= 0 && index < party.currentShots.length) {
      party.currentShots.splice(index, 1);
    }

    broadcastPartyState(user.partyCode);
  });

  // Submit Throw
  socket.on('game:submit_throw', () => {
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

    // Allow submit even with 0 shots (skip turn)
    if (party.currentShots.length > 0) {
      handleSubmitThrow(user.partyCode);
    } else {
      // Just skip to next player
      party.currentPlayerIndex = (party.currentPlayerIndex + 1) % party.players.length;
      broadcastPartyState(user.partyCode);
    }
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
