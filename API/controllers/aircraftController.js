const { getFleet } = require('../data/aircraftFleet');

function getFleetHandler(req, res) {
  res.json({ fleet: getFleet() });
}

module.exports = { getFleetHandler };
