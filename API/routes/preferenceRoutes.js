const express = require('express');
const { getPreferencesHandler, putPreferencesHandler, randomizeAllHandler } = require('../controllers/preferenceController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();

// A seat's saved conditions are health data and seat numbers are guessable, so
// everything here is crew-only. Passengers declare conditions through the
// ordering portal, where they are tied to the device that placed the order.
router.post('/seats/randomize-preferences', requireCrew, randomizeAllHandler);
router.get('/seats/:seatId/preferences', requireCrew, getPreferencesHandler);
router.put('/seats/:seatId/preferences', requireCrew, putPreferencesHandler);

module.exports = router;
