const express = require('express');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

const router = express.Router();

// GET all invoices for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ clientId: req.params.clientId }).sort({ dateSent: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all invoices
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('clientId', 'firstName lastName')
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
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
