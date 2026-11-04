const express = require('express');
const { getDiningMatrixHandler } = require('../controllers/diningController');

const router = express.Router();

router.get('/dining-matrix', getDiningMatrixHandler);

module.exports = router;
