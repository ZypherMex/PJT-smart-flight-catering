const express = require('express');
const rateLimit = require('express-rate-limit');
const { loginHandler, sessionHandler } = require('../controllers/crewController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();

// Brute-forcing a 6-digit passkey is otherwise trivial from any phone on the network.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a minute and try again.' },
});

router.post('/crew/login', loginLimiter, loginHandler);
router.get('/crew/session', requireCrew, sessionHandler);

module.exports = router;
