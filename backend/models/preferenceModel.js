const db = require('../db/connection');

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

// body.checks = { allergies: ['Peanuts', ...], intolerances: [...], medicalConditions: [...], other: [...] }
// body.mealChoice / body.mealChoiceContext = single-choice wine name or veg/nonVeg + its haul/time context.
function upsertPreferences(seatId, body) {
  const columnValues = { ...EMPTY_ROW };
  const checks = body.checks || {};
  for (const [groupKey, items] of Object.entries(CHECKBOX_COLUMNS)) {
    const selected = new Set(checks[groupKey] || []);
    for (const [label, col] of Object.entries(items)) {
      if (selected.has(label)) columnValues[col] = 1;
    }
  }

  const existing = db.prepare('SELECT 1 FROM seat_preferences WHERE seat_id = ?').get(seatId);
  const columns = Object.keys(columnValues);
  const placeholders = columns.map(() => '?').join(', ');

  if (existing) {
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    db.prepare(
      `UPDATE seat_preferences SET ${setClause}, meal_choice = ?, meal_choice_context = ?, updated_at = CURRENT_TIMESTAMP WHERE seat_id = ?`
    ).run(...columns.map((col) => columnValues[col]), body.mealChoice ?? null, body.mealChoiceContext ?? null, seatId);
  } else {
    db.prepare(
      `INSERT INTO seat_preferences (seat_id, ${columns.join(', ')}, meal_choice, meal_choice_context) VALUES (?, ${placeholders}, ?, ?)`
    ).run(seatId, ...columns.map((col) => columnValues[col]), body.mealChoice ?? null, body.mealChoiceContext ?? null);
  }

  return getPreferences(seatId);
}

module.exports = { getPreferences, upsertPreferences, CHECKBOX_COLUMNS };
