CREATE TABLE IF NOT EXISTS seats (
  seat_id     TEXT PRIMARY KEY,
  row_number  INTEGER NOT NULL,
  seat_letter TEXT NOT NULL,
  class_type  TEXT NOT NULL CHECK(class_type IN ('First','Business','Economy'))
);

CREATE TABLE IF NOT EXISTS seat_preferences (
  seat_id                    TEXT PRIMARY KEY REFERENCES seats(seat_id),
  peanut_allergy             INTEGER NOT NULL DEFAULT 0,
  egg_allergy                INTEGER NOT NULL DEFAULT 0,
  milk_allergy               INTEGER NOT NULL DEFAULT 0,
  sesame_allergy             INTEGER NOT NULL DEFAULT 0,
  soy_allergy                INTEGER NOT NULL DEFAULT 0,
  lactose_gluten_intolerance INTEGER NOT NULL DEFAULT 0,
  diabetes                   INTEGER NOT NULL DEFAULT 0,
  high_blood_pressure        INTEGER NOT NULL DEFAULT 0,
  high_cholesterol           INTEGER NOT NULL DEFAULT 0,
  heart_disease              INTEGER NOT NULL DEFAULT 0,
  kidney_disease             INTEGER NOT NULL DEFAULT 0,
  vegetarian_vegan           INTEGER NOT NULL DEFAULT 0,
  halal                      INTEGER NOT NULL DEFAULT 0,
  meal_choice                TEXT,
  meal_choice_context        TEXT,
  updated_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
