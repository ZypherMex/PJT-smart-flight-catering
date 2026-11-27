const db = require('../db/connection');
const { getAllSeatsWithPreferenceFlag } = require('./seatModel');
const { DINING } = require('../data/diningMatrix');
const { GROUP_KEYS, listConditions, getLabelToIdMap } = require('./healthConditionModel');
const { MAX_CONDITIONS } = require('../config');

const HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];
const TIME_WINDOWS = ['breakfast', 'lunchDinner', 'eveningSnack'];

function emptyChecks() {
  return Object.fromEntries(GROUP_KEYS.map((key) => [key, []]));
}

function getSelectedConditions(seatId) {
  return db
    .prepare(
      `SELECT hc.id, hc.label, hc.group_name AS groupName
       FROM seat_conditions sc
       JOIN health_conditions hc ON hc.id = sc.condition_id
       WHERE sc.seat_id = ? AND hc.active = 1
       ORDER BY hc.sort_order, hc.label`
    )
    .all(seatId);
}

function getPreferences(seatId) {
  const row = db.prepare('SELECT * FROM seat_preferences WHERE seat_id = ?').get(seatId);
  const checks = emptyChecks();
  for (const condition of getSelectedConditions(seatId)) {
    checks[condition.groupName].push(condition.label);
  }
  return {
    checks,
    mealChoice: row ? row.meal_choice : null,
    mealChoiceContext: row ? row.meal_choice_context : null,
    haulLength: row ? row.haul_length : null,
    mealTime: row ? row.meal_time : null,
    updatedAt: row ? row.updated_at : null,
  };
}

const EXTRA_FIELD_COLUMNS = {
  mealChoice: 'meal_choice',
  mealChoiceContext: 'meal_choice_context',
  haulLength: 'haul_length',
  mealTime: 'meal_time',
};

// Writes the per-seat meal/haul/time fields. Any field left `undefined` is
// skipped (the stored value is untouched) rather than nulled — different
// callers persist different subsets (e.g. the menu page only ever sets haulLength).
function writeExtraFields(seatId, extra) {
  db.prepare('INSERT OR IGNORE INTO seat_preferences (seat_id) VALUES (?)').run(seatId);

  const assignments = [];
  const values = [];
  for (const [field, column] of Object.entries(EXTRA_FIELD_COLUMNS)) {
    if (extra[field] === undefined) continue;
    assignments.push(`${column} = ?`);
    values.push(extra[field] ?? null);
  }
  assignments.push('updated_at = CURRENT_TIMESTAMP');

  db.prepare(`UPDATE seat_preferences SET ${assignments.join(', ')} WHERE seat_id = ?`).run(...values, seatId);
}

function replaceSeatConditions(seatId, conditionIds) {
  db.prepare('DELETE FROM seat_conditions WHERE seat_id = ?').run(seatId);
  const insert = db.prepare('INSERT OR IGNORE INTO seat_conditions (seat_id, condition_id) VALUES (?, ?)');
  for (const conditionId of conditionIds) insert.run(seatId, conditionId);
}

// checks = { allergies: ['Peanuts', ...], ... } of human-readable labels -> condition ids.
function checksToConditionIds(checks) {
  const labelToId = getLabelToIdMap();
  const ids = new Set();
  for (const labels of Object.values(checks)) {
    for (const label of labels) {
      if (labelToId.has(label)) ids.add(labelToId.get(label));
    }
  }
  return [...ids];
}

// body.checks = { allergies: ['Peanuts', ...], intolerances: [...], medicalConditions: [...], other: [...] }
//   (omit it to leave the seat's conditions untouched)
// body.mealChoice / body.mealChoiceContext = single-choice wine name or veg/nonVeg + its haul/time context.
// body.haulLength / body.mealTime = the passenger's own flight haul length and meal time, shown to crew.
const upsertTransaction = db.transaction((seatId, body) => {
  writeExtraFields(seatId, {
    mealChoice: body.mealChoice,
    mealChoiceContext: body.mealChoiceContext,
    haulLength: body.haulLength,
    mealTime: body.mealTime,
  });
  if (body.checks !== undefined) {
    replaceSeatConditions(seatId, checksToConditionIds(body.checks));
  }
});

function upsertPreferences(seatId, body) {
  upsertTransaction(seatId, body);
  return getPreferences(seatId);
}

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks a meal choice valid for that seat's class at the given haul/time —
// mirroring exactly how the manual save path scopes mealChoiceContext.
function randomMealChoiceFor(classType, haul, time) {
  if (classType === 'Economy') {
    const haulData = DINING.economy[haul];
    const timeData = haulData[time];
    if (timeData.snackOnly) return { mealChoice: null, mealChoiceContext: null };
    return { mealChoice: randomPick(['veg', 'nonVeg']), mealChoiceContext: `${haul}_${time}` };
  }
  const diningKey = classType === 'First' ? 'firstClass' : 'businessClass';
  const wineList = DINING[diningKey][haul].wineList;
  return { mealChoice: randomPick(wineList), mealChoiceContext: haul };
}

// Gives each seat's conditions an independent ~25% chance each (so results
// look like a realistic sparse passenger mix), capped at MAX_CONDITIONS.
function randomizeAllPreferences(haul, time) {
  if (!HAUL_LENGTHS.includes(haul)) throw new Error(`Invalid haul: ${haul}`);
  if (!TIME_WINDOWS.includes(time)) throw new Error(`Invalid time: ${time}`);

  const seats = getAllSeatsWithPreferenceFlag();
  const conditions = listConditions();

  const randomizeAll = db.transaction(() => {
    for (const seat of seats) {
      const picked = shuffled(conditions.filter(() => Math.random() < 0.25)).slice(0, MAX_CONDITIONS);
      const { mealChoice, mealChoiceContext } = randomMealChoiceFor(seat.classType, haul, time);
      writeExtraFields(seat.seatId, { mealChoice, mealChoiceContext, haulLength: haul, mealTime: time });
      replaceSeatConditions(seat.seatId, picked.map((condition) => condition.id));
    }
  });

  randomizeAll();
  return seats.length;
}

module.exports = {
  getPreferences,
  upsertPreferences,
  randomizeAllPreferences,
  getSelectedConditions,
  HAUL_LENGTHS,
  TIME_WINDOWS,
};
