const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    invoiceNumber: { type: String, required: true },
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    dateSent: { type: Date },
    dateReceived: { type: Date },
    paymentType: {
      type: String,
      enum: ['zelle', 'check', 'credit', 'online', 'cash', null],
      default: null,
    },
    // Zelle
    zelleDate: { type: Date },
    zelleDateTime: { type: Date },
    zelleNotes: { type: String },
    // Check
    checkDate: { type: Date },
    checkNumber: { type: String },
    checkMemo: { type: String },
    // Credit / Online
    processedDate: { type: Date },
    paymentMemo: { type: String },
    // Cash
    cashDate:  { type: Date },
    cashNotes: { type: String },
    // General
    invoiceMonth: { type: String, default: '' },
    notes: { type: String, default: '' },
    paymentProcessing: { type: Boolean, default: false },
    jobCompleted:      { type: Boolean, default: false },
    jobCompletedDate:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
