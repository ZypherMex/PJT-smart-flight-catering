const express = require('express');
const { getGridConfigHandler, getAllSeatsHandler } = require('../controllers/seatController');

const router = express.Router();

router.get('/seat-grid-config', getGridConfigHandler);
router.get('/seats', getAllSeatsHandler);

module.exports = router;
