const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Schedule = require('../models/Schedule');
const LawnCut = require('../models/LawnCut');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET all clients
router.get('/', auth, async (req, res) => {
  try {
    const clients = await Client.find().sort({ lastName: 1, firstName: 1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single client
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create client
router.post('/', auth, async (req, res) => {
  try {
    const client = new Client(req.body);
    const saved = await client.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update client
router.put('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH adjust manual credit balance
router.patch('/:id/credit', auth, async (req, res) => {
  try {
    const { adjustment } = req.body;
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    client.manualCredit = Math.max(0, (client.manualCredit || 0) + Number(adjustment));
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE client (cascades to invoices, schedule entries, and lawn cuts)
router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    await Promise.all([
      Invoice.deleteMany({ clientId: req.params.id }),
      Schedule.deleteMany({ clientId: req.params.id }),
      LawnCut.deleteMany({ clientId: req.params.id }),
    ]);

    res.json({ message: 'Client and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST import CSV
// Expected CSV columns: firstName, lastName, phone, email, address, notes, invoicePending
router.post('/import/csv', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csv())
    .on('data', (row) => {
      results.push({
        firstName: row.firstName || row['First Name'] || '',
        lastName: row.lastName || row['Last Name'] || '',
        phone: row.phone || row['Phone'] || '',
        email: row.email || row['Email'] || '',
        address: row.address || row['Address'] || '',
        notes: row.notes || row['Notes'] || '',
        invoicePending: ['true', '1', 'yes'].includes(
          (row.invoicePending || row['Invoice Pending'] || '').toLowerCase()
        ),
      });
    })
    .on('end', async () => {
      try {
        const inserted = await Client.insertMany(results, { ordered: false });
        res.status(201).json({ imported: inserted.length, clients: inserted });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
    })
    .on('error', (err) => res.status(500).json({ message: err.message }));
});

module.exports = router;
