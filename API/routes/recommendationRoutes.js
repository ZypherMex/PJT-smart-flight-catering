const express = require('express');
const { recommendMealHandler } = require('../controllers/recommendationController');

const router = express.Router();

router.post('/meal/recommend', recommendMealHandler);

module.exports = router;
