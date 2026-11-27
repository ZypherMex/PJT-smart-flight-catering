const db = require('../db/connection');

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

module.exports = { GROUP_KEYS, listConditions, getPreferenceGroups, getLabelToIdMap };
