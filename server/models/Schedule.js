const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'bi-weekly'],
      required: true,
    },
    route: { type: Number, enum: [1, 2], required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
