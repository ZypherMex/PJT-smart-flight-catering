const db = require('../db/connection');
const { getAllSeatsWithPreferenceFlag } = require('./seatModel');
const { DINING } = require('../data/diningMatrix');

const HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];
const TIME_WINDOWS = ['breakfast', 'lunchDinner', 'eveningSnack'];

// Maps each checkbox's (group, label) to its DB column — the single place
// that translates the frontend's human-readable preference items into schema columns.
const CHECKBOX_COLUMNS = {
  allergies: {
    Peanuts: 'peanut_allergy',
    Eggs: 'egg_allergy',
    'Milk / dairy': 'milk_allergy',
    Sesame: 'sesame_allergy',
    Soy: 'soy_allergy',
  },
  intolerances: {
    'Lactose / Gluten intolerance': 'lactose_gluten_intolerance',
  },
  medicalConditions: {
    Diabetes: 'diabetes',
    'High blood pressure': 'high_blood_pressure',
    'High cholesterol': 'high_cholesterol',
    'Heart disease': 'heart_disease',
    'Kidney disease': 'kidney_disease',
  },
  other: {
    'Vegetarian / vegan': 'vegetarian_vegan',
    Halal: 'halal',
  },
};

const ALL_CHECKBOX_COLUMNS = Object.values(CHECKBOX_COLUMNS).flatMap((group) => Object.values(group));

const EMPTY_ROW = Object.fromEntries(ALL_CHECKBOX_COLUMNS.map((col) => [col, 0]));

function rowToApiShape(row) {
  if (!row) {
    return {
      checks: { allergies: [], intolerances: [], medicalConditions: [], other: [] },
      mealChoice: null,
      mealChoiceContext: null,
      haulLength: null,
      mealTime: null,
      updatedAt: null,
    };
  }
  const checks = {};
  for (const [groupKey, items] of Object.entries(CHECKBOX_COLUMNS)) {
    checks[groupKey] = Object.entries(items)
      .filter(([, col]) => row[col] === 1)
      .map(([label]) => label);
  }
  return {
    checks,
    mealChoice: row.meal_choice,
    mealChoiceContext: row.meal_choice_context,
    haulLength: row.haul_length,
    mealTime: row.meal_time,
    updatedAt: row.updated_at,
  };
}

function getPreferences(seatId) {
  const row = db.prepare('SELECT * FROM seat_preferences WHERE seat_id = ?').get(seatId);
  return rowToApiShape(row);
}

const EXTRA_FIELD_COLUMNS = {
  mealChoice: 'meal_choice',
  mealChoiceContext: 'meal_choice_context',
  haulLength: 'haul_length',
  mealTime: 'meal_time',
};

// Shared write path for a single seat's checkbox columns + meal/haul/time —
// used by both the manual single-seat save and the bulk randomizer so the
// insert/update SQL only lives in one place. Any `extra` field left
// `undefined` is skipped (leaves the existing DB value untouched) rather
// than being nulled out — different callers persist different subsets
// (e.g. the menu-ordering page only ever touches haulLength, never mealTime).
function writePreferenceRow(seatId, columnValues, extra = {}) {
  const existing = db.prepare('SELECT 1 FROM seat_preferences WHERE seat_id = ?').get(seatId);
  const columns = Object.keys(columnValues);

  const extraColumns = [];
  const extraValues = [];
  for (const [field, column] of Object.entries(EXTRA_FIELD_COLUMNS)) {
    if (extra[field] === undefined) continue;
    extraColumns.push(column);
    extraValues.push(extra[field] ?? null);
  }

  if (existing) {
    const setClause = [...columns, ...extraColumns].map((col) => `${col} = ?`).join(', ');
    db.prepare(
      `UPDATE seat_preferences SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE seat_id = ?`
    ).run(...columns.map((col) => columnValues[col]), ...extraValues, seatId);
  } else {
    const allColumns = [...columns, ...extraColumns];
    const placeholders = allColumns.map(() => '?').join(', ');
    db.prepare(
      `INSERT INTO seat_preferences (seat_id, ${allColumns.join(', ')}) VALUES (?, ${placeholders})`
    ).run(seatId, ...columns.map((col) => columnValues[col]), ...extraValues);
  }
}

function checksToColumnValues(checks) {
  const columnValues = { ...EMPTY_ROW };
  for (const [groupKey, items] of Object.entries(CHECKBOX_COLUMNS)) {
    const selected = new Set(checks[groupKey] || []);
    for (const [label, col] of Object.entries(items)) {
      if (selected.has(label)) columnValues[col] = 1;
    }
  }
  return columnValues;
}

// body.checks = { allergies: ['Peanuts', ...], intolerances: [...], medicalConditions: [...], other: [...] }
// body.mealChoice / body.mealChoiceContext = single-choice wine name or veg/nonVeg + its haul/time context.
// body.haulLength / body.mealTime = the passenger's own flight haul length and meal time, shown to crew.
function upsertPreferences(seatId, body) {
  const columnValues = checksToColumnValues(body.checks || {});
  writePreferenceRow(seatId, columnValues, {
    mealChoice: body.mealChoice,
    mealChoiceContext: body.mealChoiceContext,
    haulLength: body.haulLength,
    mealTime: body.mealTime,
  });
  return getPreferences(seatId);
}

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Gives each seat's checkboxes an independent ~25% chance of being checked
// (so results look like a realistic sparse passenger mix, not everything
// ticked), and picks a meal choice valid for that seat's class at the given
// haul/time — mirroring exactly how the manual save path scopes mealChoiceContext.
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

function randomizeAllPreferences(haul, time) {
  if (!HAUL_LENGTHS.includes(haul)) throw new Error(`Invalid haul: ${haul}`);
  if (!TIME_WINDOWS.includes(time)) throw new Error(`Invalid time: ${time}`);

  const seats = getAllSeatsWithPreferenceFlag();

  const randomizeAll = db.transaction(() => {
    for (const seat of seats) {
      const checks = {};
      for (const [groupKey, items] of Object.entries(CHECKBOX_COLUMNS)) {
        checks[groupKey] = Object.keys(items).filter(() => Math.random() < 0.25);
      }
      const columnValues = checksToColumnValues(checks);
      const { mealChoice, mealChoiceContext } = randomMealChoiceFor(seat.classType, haul, time);
      writePreferenceRow(seat.seatId, columnValues, { mealChoice, mealChoiceContext, haulLength: haul, mealTime: time });
    }
  });

  randomizeAll();
  return seats.length;
}

module.exports = {
  getPreferences,
  upsertPreferences,
  randomizeAllPreferences,
  CHECKBOX_COLUMNS,
  HAUL_LENGTHS,
  TIME_WINDOWS,
};
