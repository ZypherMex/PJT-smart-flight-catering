const express = require('express');
const rateLimit = require('express-rate-limit');
const { recommendMealHandler } = require('../controllers/recommendationController');

const router = express.Router();

// Every call spends AI quota and the endpoint is open to the whole network, so cap it per device.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT) || 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many suggestion requests. Please wait a minute and try again.' },
});

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/meal/recommend', aiLimiter, wrap(recommendMealHandler));

module.exports = router;
