const { DINING, PREFERENCE_GROUPS } = require('../data/diningMatrix');

function getDiningMatrixHandler(req, res) {
  res.json({ dining: DINING, preferenceGroups: PREFERENCE_GROUPS });
}

module.exports = { getDiningMatrixHandler };
