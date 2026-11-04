const express = require('express');
const { getGridConfigHandler, getAllSeatsHandler, getSeatHandler } = require('../controllers/seatController');

const router = express.Router();

router.get('/seat-grid-config', getGridConfigHandler);
router.get('/seats', getAllSeatsHandler);
router.get('/seats/:seatId', getSeatHandler);

module.exports = router;
