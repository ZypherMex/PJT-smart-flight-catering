const db = require('../db/connection');
const HttpError = require('../utils/HttpError');
const { MAX_CONDITIONS } = require('../config');

const GROUP_KEYS = ['allergies', 'intolerances', 'medicalConditions', 'other'];

function listConditions({ activeOnly = true } = {}) {
  return db
    .prepare(
      `SELECT id, label, group_name AS groupName, sort_order AS sortOrder, active, builtin
       FROM health_conditions
       ${activeOnly ? 'WHERE active = 1' : ''}
       ORDER BY sort_order, label`
    )
    .all();
}

// { allergies: ['Peanuts', ...], intolerances: [...], medicalConditions: [...], other: [...] }
// — the same shape the frontend checkbox groups have always consumed.
function getPreferenceGroups() {
  const groups = Object.fromEntries(GROUP_KEYS.map((key) => [key, []]));
  for (const condition of listConditions()) {
    groups[condition.groupName].push(condition.label);
  }
  return groups;
}

function getLabelToIdMap() {
  return new Map(listConditions().map((condition) => [condition.label, condition.id]));
}

// Turns a client-supplied list of condition ids into active condition records, or
// throws a 400. Used wherever a passenger declares conditions without logging in.
function resolveConditions(ids) {
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw new HttpError(400, '"conditions" must be an array of condition ids');
  }
  const unique = [...new Set(ids)];
  const active = new Map(listConditions().map((condition) => [condition.id, condition]));
  const unknown = unique.find((id) => !active.has(id));
  if (unknown) throw new HttpError(400, `Unknown health condition: ${unknown}`);
  if (unique.length > MAX_CONDITIONS) throw new HttpError(400, `You can select at most ${MAX_CONDITIONS} health conditions`);
  return unique.map((id) => active.get(id));
}

module.exports = { GROUP_KEYS, listConditions, getPreferenceGroups, getLabelToIdMap, resolveConditions };
