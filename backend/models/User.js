import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: null // Path to uploaded image or Google profile pic URL
  },
  elo: {
    type: Number,
    default: 1000 // Starting ELO rating
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  weeklyResetDate: {
    type: Date,
    default: null // Last weekly reset date
  },
  // All-time stats (never reset)
  allTimeWins: {
    type: Number,
    default: 0
  },
  allTimeLosses: {
    type: Number,
    default: 0
  },
  allTimeHighestElo: {
    type: Number,
    default: 1000
  },
  totalGamesPlayed: {
    type: Number,
    default: 0
  },
  // Player stats for badges
  maxThrow: {
    type: Number,
    default: 0 // Highest single throw score (e.g., 180)
  },
  highestCheckout: {
    type: Number,
    default: 0 // Highest checkout score
  },
  perfectGames: {
    type: Number,
    default: 0 // Number of perfect games (9-dart finishes)
  },
  winStreak: {
    type: Number,
    default: 0 // Longest win streak
  },
  currentWinStreak: {
    type: Number,
    default: 0 // Current consecutive wins
  },
  // Badge system
  badges: [{
    id: String,
    name: String,
    description: String,
    icon: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  selectedBadge: {
    type: String,
    default: null // Badge ID of the selected badge to display
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);
