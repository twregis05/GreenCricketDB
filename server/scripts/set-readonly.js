/**
 * Usage (run from the server/ directory):
 *   node scripts/set-readonly.js <email> <true|false>
 *
 * Examples:
 *   node scripts/set-readonly.js jane@example.com true   ← restrict to read-only
 *   node scripts/set-readonly.js jane@example.com false  ← restore full access
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const [, , email, flag] = process.argv;

if (!email || !['true', 'false'].includes(flag)) {
  console.error('Usage: node scripts/set-readonly.js <email> <true|false>');
  process.exit(1);
}

const readOnly = flag === 'true';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { readOnly },
    { new: true }
  );
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`✓ ${user.email} → readOnly: ${user.readOnly}`);
  process.exit(0);
}).catch((err) => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});
