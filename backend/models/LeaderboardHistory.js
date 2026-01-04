import mongoose from 'mongoose';

const leaderboardHistorySchema = new mongoose.Schema({
  weekStartDate: {
    type: Date,
    required: true,
    index: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  leaderboard: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    profilePicture: String,
    elo: {
      type: Number,
      required: true
    },
    wins: {
      type: Number,
      required: true
    },
    losses: {
      type: Number,
      required: true
    },
    rank: {
      type: Number,
      required: true
    },
    badges: [{
      id: String,
      name: String,
      description: String,
      icon: String
    }],
    selectedBadge: String,
    selectedBadgeObj: {
      id: String,
      name: String,
      description: String,
      icon: String
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for efficient querying
leaderboardHistorySchema.index({ weekStartDate: -1, weekEndDate: -1 });

export default mongoose.model('LeaderboardHistory', leaderboardHistorySchema);
