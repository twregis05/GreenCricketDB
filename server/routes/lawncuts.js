const express = require('express');
const LawnCut = require('../models/LawnCut');
const auth = require('../middleware/auth');

const router = express.Router();

// GET all cuts for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const cuts = await LawnCut.find({ clientId: req.params.clientId })
      .sort({ cutDate: -1, createdAt: -1 });
    res.json(cuts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all cuts (with client info)
router.get('/', auth, async (req, res) => {
  try {
    const cuts = await LawnCut.find()
      .populate('clientId', 'firstName lastName groupName clientType properties')
      .sort({ cutDate: -1 });
    res.json(cuts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create
router.post('/', auth, async (req, res) => {
  try {
    const cut = new LawnCut(req.body);
    const saved = await cut.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', auth, async (req, res) => {
  try {
    const cut = await LawnCut.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!cut) return res.status(404).json({ message: 'Entry not found' });
    res.json(cut);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const cut = await LawnCut.findByIdAndDelete(req.params.id);
    if (!cut) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
