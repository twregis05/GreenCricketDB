const express = require('express');
const Schedule = require('../models/Schedule');
const auth = require('../middleware/auth');

const router = express.Router();

// GET all schedules (with client info populated)
router.get('/', auth, async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate('clientId', 'firstName lastName')
      .sort({ route: 1, dayOfWeek: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET schedules by route
router.get('/route/:routeNum', auth, async (req, res) => {
  try {
    const schedules = await Schedule.find({ route: Number(req.params.routeNum) })
      .populate('clientId', 'firstName lastName')
      .sort({ dayOfWeek: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single schedule
router.get('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).populate('clientId', 'firstName lastName');
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create schedule entry
router.post('/', auth, async (req, res) => {
  try {
    const schedule = new Schedule(req.body);
    const saved = await schedule.save();
    await saved.populate('clientId', 'firstName lastName');
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update schedule entry
router.put('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('clientId', 'firstName lastName');
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE schedule entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
