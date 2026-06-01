const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ message: 'PIN required' });

  const envPin = (process.env.PIN || '').trim();
  const submitted = String(pin).trim();

  console.log(`[auth] submitted="${submitted}" (len ${submitted.length}) | env="${envPin}" (len ${envPin.length})`);

  if (submitted === envPin) {
    const token = jwt.sign({ authenticated: true }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });
    return res.json({ token });
  }

  res.status(401).json({ message: 'Incorrect PIN' });
});

module.exports = router;
