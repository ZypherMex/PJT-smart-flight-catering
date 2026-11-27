const express = require('express');
const { qrSvgHandler, qrPngHandler, serverInfoHandler } = require('../controllers/qrController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/qr.svg', wrap(qrSvgHandler));
router.get('/qr.png', wrap(qrPngHandler));
router.get('/server-info', requireCrew, serverInfoHandler);

module.exports = router;
