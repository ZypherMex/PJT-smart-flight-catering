const { getGridConfig } = require('../data/seatGrid');
const { getAllSeatsWithPreferenceFlag, getSeat } = require('../models/seatModel');

function getGridConfigHandler(req, res) {
  res.json(getGridConfig());
}

function getAllSeatsHandler(req, res) {
  res.json(getAllSeatsWithPreferenceFlag());
}

function getSeatHandler(req, res) {
  const seat = getSeat(req.params.seatId);
  if (!seat) {
    return res.status(404).json({ error: `Unknown seat: ${req.params.seatId}` });
  }
  res.json(seat);
}

module.exports = { getGridConfigHandler, getAllSeatsHandler, getSeatHandler };
