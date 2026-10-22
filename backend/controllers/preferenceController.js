const { seatExists } = require('../models/seatModel');
const { getPreferences, upsertPreferences } = require('../models/preferenceModel');

function getPreferencesHandler(req, res) {
  const { seatId } = req.params;
  if (!seatExists(seatId)) {
    return res.status(404).json({ error: `Unknown seat: ${seatId}` });
  }
  res.json(getPreferences(seatId));
}

function putPreferencesHandler(req, res) {
  const { seatId } = req.params;
  if (!seatExists(seatId)) {
    return res.status(404).json({ error: `Unknown seat: ${seatId}` });
  }
  const saved = upsertPreferences(seatId, req.body || {});
  res.json(saved);
}

module.exports = { getPreferencesHandler, putPreferencesHandler };
