const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String },
    invoicePending: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
