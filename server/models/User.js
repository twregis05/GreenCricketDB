const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    approved:     { type: Boolean, default: false },
    role:         { type: String, enum: ['admin', 'user'], default: 'user' },
    readOnly:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
