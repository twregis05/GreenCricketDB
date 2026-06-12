const express = require('express');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const auth = require('../middleware/auth');

const router = express.Router();

// After any invoice write, recalculate whether the client has outstanding invoices
async function syncClientPending(clientId) {
  const invoices = await Invoice.find({ clientId });
  const hasPending = invoices.some((inv) => (inv.amountPaid || 0) < (inv.amountDue || 0));
  await Client.findByIdAndUpdate(clientId, { invoicePending: hasPending });
}

// GET all invoices for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ clientId: req.params.clientId }).sort({ dateSent: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET next invoice number (max numeric value + 1, zero-padded to 4 digits)
router.get('/next-number', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({}, 'invoiceNumber');
    let max = 0;
    for (const inv of invoices) {
      const n = parseInt(inv.invoiceNumber, 10);
      if (!isNaN(n) && n > max) max = n;
    }
    res.json({ next: String(max + 1).padStart(4, '0') });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all invoices
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('clientId', 'firstName lastName groupName clientType properties')
      .sort({ dateSent: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId', 'firstName lastName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create invoice
router.post('/', auth, async (req, res) => {
  try {
    const invoice = new Invoice(req.body);
    const saved = await invoice.save();
    await syncClientPending(saved.clientId);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update invoice
router.put('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    await syncClientPending(invoice.clientId);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    await syncClientPending(invoice.clientId);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
