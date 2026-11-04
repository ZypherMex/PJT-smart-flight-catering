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
    updatedAt: row.updated_at,
  };
}

function getPreferences(seatId) {
  const row = db.prepare('SELECT * FROM seat_preferences WHERE seat_id = ?').get(seatId);
  return rowToApiShape(row);
}

// Shared write path for a single seat's checkbox columns + meal choice —
// used by both the manual single-seat save and the bulk randomizer so the
// insert/update SQL only lives in one place.
function writePreferenceRow(seatId, columnValues, mealChoice, mealChoiceContext) {
  const existing = db.prepare('SELECT 1 FROM seat_preferences WHERE seat_id = ?').get(seatId);
  const columns = Object.keys(columnValues);
  const placeholders = columns.map(() => '?').join(', ');

  if (existing) {
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    db.prepare(
      `UPDATE seat_preferences SET ${setClause}, meal_choice = ?, meal_choice_context = ?, updated_at = CURRENT_TIMESTAMP WHERE seat_id = ?`
    ).run(...columns.map((col) => columnValues[col]), mealChoice ?? null, mealChoiceContext ?? null, seatId);
  } else {
    db.prepare(
      `INSERT INTO seat_preferences (seat_id, ${columns.join(', ')}, meal_choice, meal_choice_context) VALUES (?, ${placeholders}, ?, ?)`
    ).run(seatId, ...columns.map((col) => columnValues[col]), mealChoice ?? null, mealChoiceContext ?? null);
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
function upsertPreferences(seatId, body) {
  const columnValues = checksToColumnValues(body.checks || {});
  writePreferenceRow(seatId, columnValues, body.mealChoice, body.mealChoiceContext);
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
      writePreferenceRow(seat.seatId, columnValues, mealChoice, mealChoiceContext);
    }
  });

  randomizeAll();
  return seats.length;
}

module.exports = { getPreferences, upsertPreferences, randomizeAllPreferences, CHECKBOX_COLUMNS };
