const db = require('../db/connection');

function getAllSeatsWithPreferenceFlag() {
  return db
    .prepare(
      `SELECT s.seat_id AS seatId, s.row_number AS row, s.seat_letter AS letter, s.class_type AS classType,
              CASE WHEN p.seat_id IS NOT NULL AND (
                p.peanut_allergy = 1 OR p.egg_allergy = 1 OR p.milk_allergy = 1 OR p.sesame_allergy = 1 OR p.soy_allergy = 1 OR
                p.lactose_gluten_intolerance = 1 OR p.diabetes = 1 OR p.high_blood_pressure = 1 OR p.high_cholesterol = 1 OR
                p.heart_disease = 1 OR p.kidney_disease = 1 OR p.vegetarian_vegan = 1 OR p.halal = 1 OR
                p.meal_choice IS NOT NULL
              ) THEN 1 ELSE 0 END AS hasPreferences
       FROM seats s
       LEFT JOIN seat_preferences p ON p.seat_id = s.seat_id
       ORDER BY s.row_number, s.seat_letter`
    )
    .all();
}

function seatExists(seatId) {
  return !!db.prepare('SELECT 1 FROM seats WHERE seat_id = ?').get(seatId);
}

module.exports = { getAllSeatsWithPreferenceFlag, seatExists };
