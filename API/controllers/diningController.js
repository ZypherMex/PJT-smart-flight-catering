const { DINING } = require('../data/diningMatrix');
const { getPreferenceGroups } = require('../models/healthConditionModel');
const { MAX_CONDITIONS } = require('../config');

function getDiningMatrixHandler(req, res) {
  res.json({ dining: DINING, preferenceGroups: getPreferenceGroups(), maxConditions: MAX_CONDITIONS });
}

module.exports = { getDiningMatrixHandler };
