const express = require('express');
const { isAiConfigured } = require('../services/aiConfig');

const router = express.Router();

// Lets every page ask "is this feature switched on?" and adapt, instead of
// showing a button that cannot work. Reports only on/off, never any key.
router.get('/features', (req, res) => {
  res.json({ aiSuggestions: isAiConfigured() });
});

module.exports = router;
