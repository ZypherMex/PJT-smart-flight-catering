const express = require('express');
const { listConditions } = require('../models/healthConditionModel');
const { MAX_CONDITIONS } = require('../config');

const router = express.Router();

// Public: the ordering portal needs condition ids (not just labels) to request
// a conflict-checked menu.
router.get('/health-conditions', (req, res) => {
  res.json({
    maxConditions: MAX_CONDITIONS,
    conditions: listConditions().map(({ id, label, groupName }) => ({ id, label, group: groupName })),
  });
});

module.exports = router;
