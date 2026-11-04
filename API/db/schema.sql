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

CREATE TABLE IF NOT EXISTS menu_sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_type  TEXT NOT NULL CHECK(class_type IN ('First','Business','Economy')),
  haul_length TEXT NOT NULL CHECK(haul_length IN ('shortHaul','mediumHaul','longHaul')),
  section_name TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id  INTEGER NOT NULL REFERENCES menu_sections(id),
  name        TEXT NOT NULL,
  description TEXT,
  dietary_tag TEXT,
  icon        TEXT NOT NULL,
  image_url   TEXT,
  sort_order  INTEGER NOT NULL
);
