const { getGridConfig } = require('../data/seatGrid');
const { getAllSeatsWithPreferenceFlag } = require('../models/seatModel');

function getGridConfigHandler(req, res) {
  res.json(getGridConfig());
}

function getAllSeatsHandler(req, res) {
  res.json(getAllSeatsWithPreferenceFlag());
}

module.exports = { getGridConfigHandler, getAllSeatsHandler };
