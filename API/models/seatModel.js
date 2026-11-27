const db = require('../db/connection');

function getAllSeatsWithPreferenceFlag() {
  return db
    .prepare(
      `SELECT s.seat_id AS seatId, s.row_number AS row, s.seat_letter AS letter, s.class_type AS classType,
              p.meal_choice AS mealChoice, p.haul_length AS haulLength, p.meal_time AS mealTime,
              CASE WHEN EXISTS (SELECT 1 FROM seat_conditions sc WHERE sc.seat_id = s.seat_id)
                    OR p.meal_choice IS NOT NULL
              THEN 1 ELSE 0 END AS hasPreferences
       FROM seats s
       LEFT JOIN seat_preferences p ON p.seat_id = s.seat_id
       ORDER BY s.row_number, s.seat_letter`
    )
    .all();
}

function seatExists(seatId) {
  return !!db.prepare('SELECT 1 FROM seats WHERE seat_id = ?').get(seatId);
}

function getSeat(seatId) {
  return db
    .prepare(
      `SELECT seat_id AS seatId, row_number AS row, seat_letter AS letter, class_type AS classType
       FROM seats WHERE seat_id = ?`
    )
    .get(seatId);
}

module.exports = { getAllSeatsWithPreferenceFlag, seatExists, getSeat };
