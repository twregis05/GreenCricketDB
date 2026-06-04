const mongoose = require('mongoose');

const lawnCutSchema = new mongoose.Schema(
  {
    clientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    cutDate:    { type: Date, required: true },
    cutTime:    { type: String, default: '' },   // optional "HH:MM" string
    notes:      { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LawnCut', lawnCutSchema);
