const express = require('express');
const { getPreferencesHandler, putPreferencesHandler, randomizeAllHandler } = require('../controllers/preferenceController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();

// Overwrites every seat's saved health data, so it is crew-only.
router.post('/seats/randomize-preferences', requireCrew, randomizeAllHandler);
router.get('/seats/:seatId/preferences', getPreferencesHandler);
router.put('/seats/:seatId/preferences', putPreferencesHandler);

module.exports = router;
