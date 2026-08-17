const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name:      { type: String, trim: true },
  phone:     { type: String, trim: true },
  email:     { type: String, trim: true, lowercase: true },
  isPrimary: { type: Boolean, default: false },
}, { _id: true });

const propertySchema = new mongoose.Schema({
  label:   { type: String, trim: true },
  address: { type: String, trim: true },
}, { _id: true });

const clientSchema = new mongoose.Schema(
  {
    clientType: { type: String, enum: ['individual', 'group'], default: 'individual' },

    // Individual primary contact
    firstName: { type: String, trim: true },
    lastName:  { type: String, trim: true },
    phone:     { type: String, trim: true },
    email:     { type: String, trim: true, lowercase: true },

    // Group
    groupName: { type: String, trim: true },

    // Additional / group contacts
    contacts: [contactSchema],

    // Multiple service addresses
    properties: [propertySchema],

    notes:          { type: String },
    invoicePending: { type: Boolean, default: false },
    manualCredit:   { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
