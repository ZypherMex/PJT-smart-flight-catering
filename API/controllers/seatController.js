const { getGridConfig } = require('../data/seatGrid');
const { getAllSeatsWithPreferenceFlag, getSeat } = require('../models/seatModel');
const { isValidToken, tokenFromRequest } = require('../middleware/crewAuth');

function getGridConfigHandler(req, res) {
  res.json(getGridConfig());
}

// Anyone may see the seat layout (passengers pick their seat on the map). What
// other seats have chosen, and whether they declared anything, is crew-only.
function getAllSeatsHandler(req, res) {
  const seats = getAllSeatsWithPreferenceFlag();
  if (isValidToken(tokenFromRequest(req))) return res.json(seats);
  res.json(seats.map(({ seatId, row, letter, classType }) => ({ seatId, row, letter, classType })));
}

function getSeatHandler(req, res) {
  const seat = getSeat(req.params.seatId);
  if (!seat) {
    return res.status(404).json({ error: `Unknown seat: ${req.params.seatId}` });
  }
  res.json(seat);
}

module.exports = { getGridConfigHandler, getAllSeatsHandler, getSeatHandler };
