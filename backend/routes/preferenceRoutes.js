const express = require('express');
const { getPreferencesHandler, putPreferencesHandler } = require('../controllers/preferenceController');

const router = express.Router();

router.get('/seats/:seatId/preferences', getPreferencesHandler);
router.put('/seats/:seatId/preferences', putPreferencesHandler);

module.exports = router;
