const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    invoiceNumber: { type: String, required: true },
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    dateSent: { type: Date },
    dateReceived: { type: Date },
    paymentType: {
      type: String,
      enum: ['zelle', 'check', 'credit', 'online', null],
      default: null,
    },
    // Zelle
    zelleDateTime: { type: Date },
    zelleNotes: { type: String },
    // Check
    checkDate: { type: Date },
    checkNumber: { type: String },
    checkMemo: { type: String },
    // Credit / Online
    processedDate: { type: Date },
    paymentMemo: { type: String },
    // General
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
