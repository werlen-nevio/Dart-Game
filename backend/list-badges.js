import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

// Usage: node list-badges.js <username>
// Example: node list-badges.js "Mr. Blindsight"

async function listBadges() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 1) {
      console.log('Usage: node list-badges.js <username>');
      console.log('Example: node list-badges.js "Mr. Blindsight"');
      process.exit(1);
    }

    const [username] = args;

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/dartgame');

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`User "${username}" not found!`);
      process.exit(1);
    }

    console.log(`\n📋 Badges for ${username}:`);
    console.log(`Total: ${user.badges.length}\n`);

    if (user.badges.length === 0) {
      console.log('No badges yet!');
    } else {
      user.badges.forEach((badge, index) => {
        console.log(`${index + 1}. ${badge.icon} ${badge.name}`);
        console.log(`   ID: ${badge.id}`);
        console.log(`   Description: ${badge.description}`);
        console.log(`   Earned: ${badge.earnedAt.toLocaleDateString('de-DE')}\n`);
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listBadges();
