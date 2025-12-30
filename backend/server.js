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
app.get('/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
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
    // Try to find user in database for profile picture
    let profilePicture = null;
    try {
      const user = await User.findOne({ username });
      if (user) {
        profilePicture = user.profilePicture;
      }
    } catch (error) {
      console.log('User not found in DB, using default');
    }

    socketUsers.set(socket.id, { username, partyCode: null, profilePicture });
    socket.emit('user:logged_in', { username, profilePicture });
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
        profilePicture: user.profilePicture
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
    const user = socketUsers.get(socket.id);
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
        socketId: socket.id,
        profilePicture: user.profilePicture
      });
    } else {
      // Reconnect: update socketId and profile picture
      existing.socketId = socket.id;
      existing.profilePicture = user.profilePicture;
    }

    user.partyCode = code;
    socket.join(code);

    socket.emit('party:joined', party);
    broadcastPartyState(code);
    console.log(`${user.username} joined party ${code}`);
  });

  // Add to Current Throw
  socket.on('game:add_throw', (shotData) => {
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

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    socketUsers.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
