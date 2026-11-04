const express = require('express');
const { getMenuHandler } = require('../controllers/menuController');

const router = express.Router();

router.get('/menu/:classType/:haulLength', getMenuHandler);

module.exports = router;
