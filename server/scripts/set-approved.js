/**
 * Usage (run from the server/ directory):
 *   node scripts/set-approved.js <email> <true|false>
 *
 * Examples:
 *   node scripts/set-approved.js jane@example.com true   ← approve user to use site
 *   node scripts/set-approved.js jane@example.com false  ← restrict site access 
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const [, , email, flag] = process.argv;

if (!email || !['true', 'false'].includes(flag)) {
  console.error('Usage: node scripts/set-approved.js <email> <true|false>');
  process.exit(1);
}

const approved = flag === 'true';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { approved },
    { new: true }
  );
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`✓ ${user.email} → approved: ${user.approved}`);
  process.exit(0);
}).catch((err) => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});
