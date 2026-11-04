const express = require('express');
const { getFleetHandler } = require('../controllers/aircraftController');

const router = express.Router();

router.get('/fleet', getFleetHandler);

module.exports = router;
