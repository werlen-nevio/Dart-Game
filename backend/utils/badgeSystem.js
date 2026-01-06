import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load badges from JSON file
const badgesPath = path.join(__dirname, '../data/badges.json');
let badgesData = null;

try {
  const rawData = fs.readFileSync(badgesPath, 'utf8');
  badgesData = JSON.parse(rawData);
} catch (error) {
  console.error('Error loading badges.json:', error);
  badgesData = { badges: [] };
}

export const BADGES = badgesData.badges;

/**
 * Get all available badges
 */
export function getAllBadges() {
  return BADGES;
}

/**
 * Get a badge by ID
 */
export function getBadgeById(badgeId) {
  return BADGES.find(b => b.id === badgeId);
}

/**
 * Check if user has a specific badge
 */
export function userHasBadge(user, badgeId) {
  return user.badges.some(b => b.id === badgeId);
}

/**
 * Award a badge to a user
 */
export async function awardBadge(user, badgeId) {
  const badge = getBadgeById(badgeId);
  if (!badge) {
    console.error(`Badge ${badgeId} not found`);
    return false;
  }

  // Check if user already has this badge
  if (userHasBadge(user, badgeId)) {
    return false;
  }

  // Add badge to user
  user.badges.push({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    earnedAt: new Date()
  });

  await user.save();
  console.log(`Badge "${badge.name}" awarded to ${user.username}`);
  return true;
}

/**
 * Check and award badges based on user stats after a game
 * @param {string} username - The username to check badges for
 * @param {object} gameStats - Statistics from the game
 * @param {boolean} wonGame - Whether the player won the game (default: true for backwards compatibility)
 */
export async function checkAndAwardBadges(username, gameStats = {}, wonGame = true) {
  try {
    const user = await User.findOne({ username });
    if (!user) return [];

    const newBadges = [];

    for (const badge of BADGES) {
      // Skip if user already has this badge
      if (userHasBadge(user, badge.id)) continue;

      let shouldAward = false;

      switch (badge.requirement.type) {
        case 'wins':
          shouldAward = user.allTimeWins >= badge.requirement.value;
          break;

        case 'elo':
          shouldAward = user.elo >= badge.requirement.value;
          break;

        case 'games_played':
          shouldAward = user.totalGamesPlayed >= badge.requirement.value;
          break;

        case 'win_rate':
          if (user.totalGamesPlayed >= (badge.requirement.min_games || 0)) {
            const winRate = (user.allTimeWins / user.totalGamesPlayed) * 100;
            shouldAward = winRate >= badge.requirement.value;
          }
          break;

        case 'max_score':
          // Can be earned regardless of win/loss
          shouldAward = user.maxThrow >= badge.requirement.value;
          break;

        case 'high_checkout':
          // Can be earned regardless of win/loss
          shouldAward = user.highestCheckout >= badge.requirement.value;
          break;

        case 'perfect_game':
          // Perfect games can only be achieved by winning
          if (wonGame) {
            shouldAward = user.perfectGames >= badge.requirement.value;
          }
          break;

        case 'leaderboard_rank':
          // This would be checked at the end of the week
          // For now, we skip it in post-game checks
          break;

        case 'early_adopter':
          // Check user creation order (requires querying all users)
          const userCount = await User.countDocuments({ createdAt: { $lte: user.createdAt } });
          shouldAward = userCount <= badge.requirement.value;
          break;

        case 'comeback':
          // Comeback badges require winning
          if (wonGame && gameStats.comeback >= badge.requirement.value) {
            shouldAward = true;
          }
          break;

        case 'win_streak':
          shouldAward = user.winStreak >= badge.requirement.value;
          break;

        default:
          break;
      }

      if (shouldAward) {
        const awarded = await awardBadge(user, badge.id);
        if (awarded) {
          newBadges.push(badge);
        }
      }
    }

    return newBadges;
  } catch (error) {
    console.error('Error checking badges:', error);
    return [];
  }
}

/**
 * Check leaderboard badges at the end of the week
 */
export async function checkLeaderboardBadges() {
  try {
    // Get top 3 players
    const topPlayers = await User.find({})
      .sort({ elo: -1, wins: -1 })
      .limit(3)
      .select('username badges');

    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];
      const rank = i + 1;

      // Award first place badge
      if (rank === 1 && !userHasBadge(player, 'first-place')) {
        await awardBadge(player, 'first-place');
      }

      // Award top 3 badge
      if (rank <= 3 && !userHasBadge(player, 'top-3')) {
        await awardBadge(player, 'top-3');
      }
    }
  } catch (error) {
    console.error('Error checking leaderboard badges:', error);
  }
}
