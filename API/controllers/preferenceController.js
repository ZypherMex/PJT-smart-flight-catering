const { seatExists } = require('../models/seatModel');
const { getPreferences, upsertPreferences, randomizeAllPreferences } = require('../models/preferenceModel');
const { getPreferenceGroups } = require('../models/healthConditionModel');
const { MAX_CONDITIONS } = require('../config');

const VALID_HAULS = ['shortHaul', 'mediumHaul', 'longHaul'];
const VALID_TIMES = ['breakfast', 'lunchDinner', 'eveningSnack'];

function validatePreferencesBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  if (body.checks !== undefined) {
    if (typeof body.checks !== 'object' || body.checks === null || Array.isArray(body.checks)) {
      return '"checks" must be an object';
    }
    const groups = getPreferenceGroups();
    const selected = new Set();
    for (const [groupKey, items] of Object.entries(body.checks)) {
      if (!Object.prototype.hasOwnProperty.call(groups, groupKey)) {
        return `Unknown checks group: ${groupKey}`;
      }
      if (!Array.isArray(items) || !items.every((item) => typeof item === 'string')) {
        return `"checks.${groupKey}" must be an array of strings`;
      }
      const unknown = items.find((item) => !groups[groupKey].includes(item));
      if (unknown) {
        return `Unknown ${groupKey} item: ${unknown}`;
      }
      items.forEach((item) => selected.add(item));
    }
    if (selected.size > MAX_CONDITIONS) {
      return `You can select at most ${MAX_CONDITIONS} health conditions`;
    }
  }

  if (body.mealChoice !== undefined && body.mealChoice !== null && typeof body.mealChoice !== 'string') {
    return '"mealChoice" must be a string or null';
  }

  if (
    body.mealChoiceContext !== undefined &&
    body.mealChoiceContext !== null &&
    typeof body.mealChoiceContext !== 'string'
  ) {
    return '"mealChoiceContext" must be a string or null';
  }

  if (body.haulLength !== undefined && body.haulLength !== null && !VALID_HAULS.includes(body.haulLength)) {
    return `"haulLength" must be one of ${VALID_HAULS.join(', ')}, or null`;
  }

  if (body.mealTime !== undefined && body.mealTime !== null && !VALID_TIMES.includes(body.mealTime)) {
    return `"mealTime" must be one of ${VALID_TIMES.join(', ')}, or null`;
  }

  return null;
}

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
  const validationError = validatePreferencesBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const saved = upsertPreferences(seatId, req.body || {});
  res.json(saved);
}

function randomizeAllHandler(req, res) {
  const { haul, time } = req.body || {};
  if (!VALID_HAULS.includes(haul)) {
    return res.status(400).json({ error: `Unknown haul: ${haul}` });
  }
  if (!VALID_TIMES.includes(time)) {
    return res.status(400).json({ error: `Unknown time: ${time}` });
  }
  const updatedCount = randomizeAllPreferences(haul, time);
  res.json({ updatedCount });
}

module.exports = { getPreferencesHandler, putPreferencesHandler, randomizeAllHandler };
