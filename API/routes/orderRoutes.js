const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getPortalMenuHandler,
  placeOrderHandler,
  getMyOrderHandler,
  listOrdersHandler,
  updateStatusHandler,
  deleteOrderHandler,
} = require('../controllers/orderController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();

// Orders are open to anyone on the network, so cap how fast one device can submit.
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

router.get('/portal/menu', getPortalMenuHandler);
router.post('/orders', orderLimiter, placeOrderHandler);
router.get('/orders/seat/:seatId', getMyOrderHandler);

router.get('/orders', requireCrew, listOrdersHandler);
router.patch('/orders/:id/status', requireCrew, updateStatusHandler);
router.delete('/orders/:id', requireCrew, deleteOrderHandler);

module.exports = router;
