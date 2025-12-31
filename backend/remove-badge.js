import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

// Usage: node remove-badge.js <username> <badge-id>
// Example: node remove-badge.js "Mr. Blindsight" "week-1-winner"

async function removeBadge() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.log('Usage: node remove-badge.js <username> <badge-id>');
      console.log('Example: node remove-badge.js "Mr. Blindsight" "week-1-winner"');
      process.exit(1);
    }

    const [username, badgeId] = args;

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/dartgame');
    console.log('Connected to MongoDB');

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`User "${username}" not found!`);
      process.exit(1);
    }

    // Find badge
    const badgeIndex = user.badges.findIndex(b => b.id === badgeId);
    if (badgeIndex === -1) {
      console.log(`Badge "${badgeId}" not found for user "${username}"!`);
      process.exit(1);
    }

    // Remove badge
    const removedBadge = user.badges[badgeIndex];
    user.badges.splice(badgeIndex, 1);

    await user.save();

    console.log(`✅ Badge removed successfully!`);
    console.log(`User: ${username}`);
    console.log(`Removed: ${removedBadge.icon} ${removedBadge.name}`);
    console.log(`Remaining badges: ${user.badges.length}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeBadge();
