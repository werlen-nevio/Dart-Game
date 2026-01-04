import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { connectDB } from './config/database.js';
import { setupPassport } from './config/passport.js';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true only with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());
setupPassport();

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ===== AUTH ROUTES =====

// Google OAuth login
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    res.redirect(process.env.CLIENT_URL || 'http://localhost');
  }
);

// Logout
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
app.get('/auth/user', async (req, res) => {
  if (req.isAuthenticated()) {
    // Fetch full user data including badges
    const user = await User.findById(req.user._id);
    const selectedBadgeObj = user.badges.find(badge => badge.id === user.selectedBadge);

    res.json({
      ...req.user.toObject(),
      selectedBadge: user.selectedBadge,
      selectedBadgeObj: selectedBadgeObj || null,
      badges: user.badges
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Upload profile picture
app.post('/api/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Update user's profile picture
    const user = await User.findById(req.user._id);
    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update username
app.post('/api/update-username', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Update user's username
    const user = await User.findById(req.user._id);
    user.username = username.trim();
    await user.save();

    // Update session
    req.user.username = user.username;

    res.json({
      message: 'Username updated successfully',
      username: user.username
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update selected badge
app.post('/api/update-selected-badge', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { badgeId } = req.body;

    // Update user's selected badge
    const user = await User.findById(req.user._id);

    // Validate that the badge exists in user's badges (or allow null to unselect)
    if (badgeId !== null && badgeId !== undefined && badgeId !== '') {
      const hasBadge = user.badges.some(badge => badge.id === badgeId);
      if (!hasBadge) {
        return res.status(400).json({ error: 'Badge not found in user collection' });
      }
      user.selectedBadge = badgeId;
    } else {
      user.selectedBadge = null;
    }

    await user.save();

    // Get the selected badge object
    const selectedBadgeObj = user.badges.find(badge => badge.id === user.selectedBadge);

    res.json({
      message: 'Selected badge updated successfully',
      selectedBadge: user.selectedBadge,
      selectedBadgeObj: selectedBadgeObj || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get top 100 players sorted by ELO
    const users = await User.find({})
      .sort({ elo: -1, wins: -1 })
      .limit(100)
      .select('username profilePicture elo wins losses badges selectedBadge');

    // Get next reset date (use first user's reset date or calculate new one)
    let nextResetDate;
    if (users.length > 0 && users[0].weeklyResetDate) {
      nextResetDate = users[0].weeklyResetDate;
    } else {
      nextResetDate = getNextResetDate();
    }

    res.json({
      leaderboard: users.map((user, index) => {
        const selectedBadgeObj = user.badges.find(badge => badge.id === user.selectedBadge);
        return {
          rank: index + 1,
          username: user.username,
          profilePicture: user.profilePicture,
          elo: user.elo,
          wins: user.wins,
          losses: user.losses,
          winRate: user.wins + user.losses > 0
            ? Math.round((user.wins / (user.wins + user.losses)) * 100)
            : 0,
          selectedBadgeObj: selectedBadgeObj || null
        };
      }),
      nextResetDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get player profile
app.get('/api/player/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Calculate all-time win rate
    const allTimeWinRate = user.allTimeWins + user.allTimeLosses > 0
      ? Math.round((user.allTimeWins / (user.allTimeWins + user.allTimeLosses)) * 100)
      : 0;

    // Calculate current week win rate
    const weeklyWinRate = user.wins + user.losses > 0
      ? Math.round((user.wins / (user.wins + user.losses)) * 100)
      : 0;

    // Get selected badge object
    const selectedBadgeObj = user.badges.find(badge => badge.id === user.selectedBadge);

    res.json({
      username: user.username,
      profilePicture: user.profilePicture,
      // Current week stats
      elo: user.elo,
      wins: user.wins,
      losses: user.losses,
      weeklyWinRate,
      // All-time stats
      allTimeWins: user.allTimeWins,
      allTimeLosses: user.allTimeLosses,
      allTimeHighestElo: user.allTimeHighestElo,
      totalGamesPlayed: user.totalGamesPlayed,
      allTimeWinRate,
      // Badges
      badges: user.badges || [],
      selectedBadge: user.selectedBadge,
      selectedBadgeObj: selectedBadgeObj || null,
      // Account info
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SOCKET.IO SETUP =====

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// In-Memory Store for game state
const parties = new Map(); // partyCode -> Party
const socketUsers = new Map();   // socketId -> { username, partyCode, userId }
const disconnectTimers = new Map(); // socketId -> timeout
const disconnectCountdowns = new Map(); // socketId -> interval

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

// Helper: Update ELO for winner and loser
async function updateEloRatings(winnerUsername, loserUsername) {
  try {
    const winner = await User.findOne({ username: winnerUsername });
    const loser = await User.findOne({ username: loserUsername });

    if (!winner || !loser) {
      console.log('Could not find users for ELO update');
      return;
    }

    // Calculate ELO changes
    const { winnerChange, loserChange } = calculateEloChange(winner.elo, loser.elo);

    // Update ELO and stats
    winner.elo += winnerChange;
    winner.wins += 1;
    winner.allTimeWins += 1;
    winner.totalGamesPlayed += 1;
    if (winner.elo > winner.allTimeHighestElo) {
      winner.allTimeHighestElo = winner.elo;
    }
    if (!winner.weeklyResetDate) {
      winner.weeklyResetDate = getNextResetDate();
    }

    loser.elo = Math.max(0, loser.elo + loserChange); // Don't go below 0
    loser.losses += 1;
    loser.allTimeLosses += 1;
    loser.totalGamesPlayed += 1;
    if (loser.elo > loser.allTimeHighestElo) {
      loser.allTimeHighestElo = loser.elo;
    }
    if (!loser.weeklyResetDate) {
      loser.weeklyResetDate = getNextResetDate();
    }

    await winner.save();
    await loser.save();

    console.log(`ELO Update - ${winnerUsername}: ${winner.elo - winnerChange} → ${winner.elo} (+${winnerChange})`);
    console.log(`ELO Update - ${loserUsername}: ${loser.elo - loserChange} → ${loser.elo} (${loserChange})`);
  } catch (error) {
    console.error('Error updating ELO:', error);
  }
}

// Helper: Apply ELO Penalty for disconnect
async function applyEloPenalty(username, penalty) {
  try {
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`Could not find user ${username} for ELO penalty`);
      return;
    }

    // Apply penalty
    user.elo = Math.max(0, user.elo - penalty);
    user.losses += 1;
    user.allTimeLosses += 1;
    user.totalGamesPlayed += 1;

    if (!user.weeklyResetDate) {
      user.weeklyResetDate = getNextResetDate();
    }

    await user.save();

    console.log(`ELO Penalty - ${username}: ${user.elo + penalty} → ${user.elo} (-${penalty})`);
  } catch (error) {
    console.error('Error applying ELO penalty:', error);
  }
}

// Helper: Calculate ELO Change
function calculateEloChange(winnerElo, loserElo) {
  const K = 32; // K-factor (sensitivity of rating changes)
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoss = 1 - expectedWin;

  return {
    winnerChange: Math.round(K * (1 - expectedWin)),
    loserChange: Math.round(K * (0 - expectedLoss))
  };
}

// Helper: Get next Monday 00:00:00 UTC
function getNextResetDate() {
  const now = new Date();
  const nextMonday = new Date(now);

  // Get days until next Monday (1 = Monday, 0 = Sunday)
  const daysUntilMonday = (8 - nextMonday.getUTCDay()) % 7;
  const daysToAdd = daysUntilMonday === 0 ? 7 : daysUntilMonday;

  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysToAdd);
  nextMonday.setUTCHours(0, 0, 0, 0);

  return nextMonday;
}

// Helper: Check and perform weekly reset if needed
async function checkWeeklyReset() {
  const now = new Date();
  const users = await User.find({});

  for (const user of users) {
    // If no reset date set, or if it's past the reset date
    if (!user.weeklyResetDate || now >= user.weeklyResetDate) {
      user.elo = 1000;
      user.wins = 0;
      user.losses = 0;
      user.weeklyResetDate = getNextResetDate();
      await user.save();
      console.log(`Reset ELO for user: ${user.username}`);
    }
  }
}

// Run weekly reset check every hour
setInterval(checkWeeklyReset, 60 * 60 * 1000);
// Run on startup
checkWeeklyReset();

// Helper: Handle Submit Throw
function handleSubmitThrow(partyCode) {
  const party = parties.get(partyCode);
  if (!party) return;

  const currentPlayer = party.players[party.currentPlayerIndex];
  const throwValue = party.currentShots.reduce((sum, s) => sum + s.value, 0);
  const newScore = currentPlayer.score - throwValue;

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

// ===== SOCKET.IO EVENTS =====

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Login (simplified - now just stores username)
  socket.on('user:login', async (username) => {
    // Try to find user in database for profile picture and badge
    let profilePicture = null;
    let selectedBadgeObj = null;
    try {
      const user = await User.findOne({ username });
      if (user) {
        profilePicture = user.profilePicture;
        selectedBadgeObj = user.badges.find(badge => badge.id === user.selectedBadge);
      }
    } catch (error) {
      console.log('User not found in DB, using default');
    }

    socketUsers.set(socket.id, { username, partyCode: null, profilePicture, selectedBadgeObj });
    socket.emit('user:logged_in', { username, profilePicture, selectedBadgeObj });
    console.log(`User logged in: ${username}`);
  });

  // Create Party
  socket.on('party:create', ({ partyName, mode, outMode }) => {
    const user = socketUsers.get(socket.id);
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
        socketId: socket.id,
        profilePicture: user.profilePicture,
        selectedBadgeObj: user.selectedBadgeObj
      }],
      spectators: [],
      gameState: 'lobby', // 'lobby' or 'active'
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

  // Get Active Parties
  socket.on('party:get_active', () => {
    const user = socketUsers.get(socket.id);
    if (!user) return socket.emit('error', 'Not logged in');

    // Convert parties map to array with relevant info
    const activeParties = Array.from(parties.values()).map(party => ({
      code: party.code,
      name: party.name,
      mode: party.mode,
      outMode: party.outMode,
      playerCount: party.players.length,
      gameState: party.gameState || 'lobby',
      players: party.players.map(p => ({
        username: p.username,
        profilePicture: p.profilePicture,
        selectedBadgeObj: p.selectedBadgeObj
      }))
    }));

    socket.emit('party:active_list', activeParties);
  });

  // Join Party
  socket.on('party:join', (code) => {
    const user = socketUsers.get(socket.id);
    if (!user) return socket.emit('error', 'Not logged in');

    const party = parties.get(code);
    if (!party) return socket.emit('error', 'Party not found');

    // Check if already in party (allow rejoin even if game is active)
    const existing = party.players.find(p => p.username === user.username);

    if (!existing) {
      // Not in party - check if game is already active
      if (party.gameState === 'active') {
        return socket.emit('error', 'Spiel läuft bereits! Du kannst nur als Zuschauer beitreten.');
      }

      // Add new player
      const startScore = party.mode === '301' ? 301 : 501;
      party.players.push({
        username: user.username,
        score: startScore,
        socketId: socket.id,
        profilePicture: user.profilePicture,
        selectedBadgeObj: user.selectedBadgeObj
      });
    } else {
      // Reconnect: Find and cancel disconnect timer from old socket
      const oldSocketId = existing.socketId;

      // Cancel disconnect timer if exists
      if (disconnectTimers.has(oldSocketId)) {
        clearTimeout(disconnectTimers.get(oldSocketId));
        disconnectTimers.delete(oldSocketId);
      }

      // Cancel countdown interval if exists
      if (disconnectCountdowns.has(oldSocketId)) {
        clearInterval(disconnectCountdowns.get(oldSocketId));
        disconnectCountdowns.delete(oldSocketId);
      }

      // Update player info
      existing.socketId = socket.id;
      existing.profilePicture = user.profilePicture;
      existing.selectedBadgeObj = user.selectedBadgeObj;

      // Notify other players that the player reconnected
      io.to(code).emit('player:reconnected', { username: user.username });
    }

    user.partyCode = code;
    socket.join(code);

    socket.emit('party:joined', party);
    broadcastPartyState(code);
    console.log(`${user.username} joined party ${code}`);
  });

  // Spectate Party
  socket.on('party:spectate', (code) => {
    const user = socketUsers.get(socket.id);
    if (!user) return socket.emit('error', 'Not logged in');

    const party = parties.get(code);
    if (!party) return socket.emit('error', 'Party not found');

    // Initialize spectators array if it doesn't exist (for backwards compatibility)
    if (!party.spectators) {
      party.spectators = [];
    }

    // Check if already a player
    const isPlayer = party.players.find(p => p.username === user.username);
    if (isPlayer) {
      // Just rejoin as player
      user.partyCode = code;
      socket.join(code);
      socket.emit('party:joined', party);
      broadcastPartyState(code);
      return;
    }

    // Check if already spectating
    const existingSpectator = party.spectators.find(s => s.username === user.username);
    if (!existingSpectator) {
      party.spectators.push({
        username: user.username,
        socketId: socket.id,
        profilePicture: user.profilePicture,
        selectedBadgeObj: user.selectedBadgeObj
      });
    } else {
      // Reconnect: update socketId
      existingSpectator.socketId = socket.id;
      existingSpectator.profilePicture = user.profilePicture;
      existingSpectator.selectedBadgeObj = user.selectedBadgeObj;
    }

    user.partyCode = code;
    user.isSpectator = true;
    socket.join(code);

    socket.emit('party:spectating', party);
    broadcastPartyState(code);
    console.log(`${user.username} is spectating party ${code}`);
  });

  // Add to Current Throw
  socket.on('game:add_throw', (shotData) => {
    const user = socketUsers.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    // Check if minimum players requirement is met
    if (party.players.length < 2) {
      socket.emit('error', 'Mindestens 2 Spieler erforderlich, um zu starten!');
      return;
    }

    // Set game state to active on first throw
    if (party.gameState === 'lobby') {
      party.gameState = 'active';
      console.log(`Party ${user.partyCode} game state changed to active`);
    }

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

          // Update ELO for 1v1 games
          if (party.players.length === 2) {
            const loser = party.players.find(p => p.username !== currentPlayer.username);
            if (loser) {
              updateEloRatings(currentPlayer.username, loser.username);
            }
          }

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

        // Update ELO for 1v1 games
        if (party.players.length === 2) {
          const loser = party.players.find(p => p.username !== currentPlayer.username);
          if (loser) {
            updateEloRatings(currentPlayer.username, loser.username);
          }
        }

        io.to(user.partyCode).emit('game:winner', currentPlayer.username);
        broadcastPartyState(user.partyCode);
        return;
      }
    }

    broadcastPartyState(user.partyCode);
  });

  // Remove Shot
  socket.on('game:remove_shot', (index) => {
    const user = socketUsers.get(socket.id);
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
    const user = socketUsers.get(socket.id);
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

  // Restart Game
  socket.on('game:restart', () => {
    const user = socketUsers.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    // Reset all players to starting score
    const startScore = party.mode === '301' ? 301 : 501;
    party.players.forEach(player => {
      player.score = startScore;
    });

    // Reset game state
    party.gameState = 'lobby';
    party.currentPlayerIndex = 0;
    party.currentShots = [];
    party.history = [];

    broadcastPartyState(user.partyCode);
    console.log(`Game restarted in party ${user.partyCode}`);
  });

  // Leave Party
  socket.on('party:leave', () => {
    const user = socketUsers.get(socket.id);
    if (!user || !user.partyCode) return;

    const party = parties.get(user.partyCode);
    if (!party) return;

    // Check if user is a spectator
    if (user.isSpectator) {
      // Remove from spectators
      if (party.spectators) {
        party.spectators = party.spectators.filter(s => s.username !== user.username);
      }
      user.isSpectator = false;
    } else {
      // Remove player from party
      party.players = party.players.filter(p => p.username !== user.username);

      // If no players left, delete party
      if (party.players.length === 0) {
        parties.delete(user.partyCode);
        console.log(`Party ${user.partyCode} deleted (no players)`);
      } else {
        // Adjust current player index if needed
        if (party.currentPlayerIndex >= party.players.length) {
          party.currentPlayerIndex = 0;
        }
      }
    }

    broadcastPartyState(user.partyCode);
    socket.leave(user.partyCode);
    user.partyCode = null;
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const user = socketUsers.get(socket.id);
    if (user && user.partyCode) {
      const party = parties.get(user.partyCode);

      // Notify other players about the disconnect
      if (party && party.gameState === 'active' && !user.isSpectator) {
        const disconnectedPlayer = party.players.find(p => p.socketId === socket.id);
        if (disconnectedPlayer) {
          io.to(user.partyCode).emit('player:disconnected', {
            username: user.username,
            timeRemaining: 30
          });
        }
      }

      // Send countdown updates every second
      let countdown = 30;
      const countdownInterval = setInterval(() => {
        countdown--;
        const currentParty = parties.get(user.partyCode);
        if (currentParty && currentParty.gameState === 'active') {
          io.to(user.partyCode).emit('player:disconnect_countdown', {
            username: user.username,
            timeRemaining: countdown
          });
        }
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          disconnectCountdowns.delete(socket.id);
        }
      }, 1000);

      disconnectCountdowns.set(socket.id, countdownInterval);

      // Set a 30-second timer before removing from party
      const timer = setTimeout(() => {
        if (disconnectCountdowns.has(socket.id)) {
          clearInterval(disconnectCountdowns.get(socket.id));
          disconnectCountdowns.delete(socket.id);
        }

        const party = parties.get(user.partyCode);
        if (!party) {
          socketUsers.delete(socket.id);
          disconnectTimers.delete(socket.id);
          return;
        }

        // Find the disconnected player
        const disconnectedPlayer = party.players.find(p => p.socketId === socket.id);

        // Check if game is active
        if (party.gameState === 'active' && disconnectedPlayer) {
          if (party.players.length === 2) {
            // 1v1: Award win to the remaining player
            const remainingPlayer = party.players.find(p => p.socketId !== socket.id);

            if (remainingPlayer) {
              console.log(`Player ${user.username} did not rejoin. Awarding win to ${remainingPlayer.username}`);

              // Update ELO ratings
              updateEloRatings(remainingPlayer.username, disconnectedPlayer.username);

              // Emit winner event
              io.to(user.partyCode).emit('game:winner', remainingPlayer.username);
              io.to(user.partyCode).emit('error', `${disconnectedPlayer.username} hat das Spiel verlassen. ${remainingPlayer.username} gewinnt!`);
            }
          } else {
            // Multi-player: Apply -50 ELO penalty to disconnected player
            console.log(`Player ${user.username} left multi-player game. Applying -50 ELO penalty.`);

            // Apply ELO penalty
            applyEloPenalty(disconnectedPlayer.username, 50);

            // Notify remaining players
            io.to(user.partyCode).emit('error', `${disconnectedPlayer.username} hat das Spiel verlassen und verliert 50 ELO.`);
          }
        }

        // Remove player from party (including spectators)
        if (user.isSpectator) {
          if (party.spectators) {
            party.spectators = party.spectators.filter(s => s.socketId !== socket.id);
          }
        } else {
          party.players = party.players.filter(p => p.socketId !== socket.id);
        }

        // If no players left, delete party
        if (party.players.length === 0) {
          parties.delete(user.partyCode);
          console.log(`Party ${user.partyCode} deleted (all disconnected)`);
        } else {
          // Adjust current player index if needed
          if (party.currentPlayerIndex >= party.players.length) {
            party.currentPlayerIndex = 0;
          }
          broadcastPartyState(user.partyCode);
        }

        socketUsers.delete(socket.id);
        disconnectTimers.delete(socket.id);
        console.log(`User ${user.username} removed from party after 30s`);
      }, 30000); // 30 seconds

      disconnectTimers.set(socket.id, timer);
      console.log(`User ${user.username} disconnected, 30s timer started`);
    } else {
      socketUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
