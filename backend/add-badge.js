import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

// Usage: node add-badge.js <username> <badge-id> <badge-name> <badge-icon> [description]
// Example: node add-badge.js "Mr. Blindsight" "week-1-winner" "Week 1 Winner" "🏆" "Gewinner der ersten Woche"

async function addBadge() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 4) {
      console.log('Usage: node add-badge.js <username> <badge-id> <badge-name> <badge-icon> [description]');
      console.log('Example: node add-badge.js "Mr. Blindsight" "week-1-winner" "Week 1 Winner" "🏆" "Gewinner der ersten Woche"');
      process.exit(1);
    }

    const [username, badgeId, badgeName, badgeIcon, badgeDescription = ''] = args;

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/dartgame');
    console.log('Connected to MongoDB');

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`User "${username}" not found!`);
      process.exit(1);
    }

    // Check if badge already exists
    const existingBadge = user.badges.find(b => b.id === badgeId);
    if (existingBadge) {
      console.log(`User already has badge "${badgeId}"!`);
      process.exit(1);
    }

    // Add badge
    user.badges.push({
      id: badgeId,
      name: badgeName,
      description: badgeDescription,
      icon: badgeIcon,
      earnedAt: new Date()
    });

    await user.save();

    console.log(`✅ Badge added successfully!`);
    console.log(`User: ${username}`);
    console.log(`Badge: ${badgeIcon} ${badgeName}`);
    console.log(`Description: ${badgeDescription}`);
    console.log(`Total badges: ${user.badges.length}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addBadge();
