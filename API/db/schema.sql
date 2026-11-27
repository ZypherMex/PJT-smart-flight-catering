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
  haul_length                TEXT,
  meal_time                  TEXT,
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
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL REFERENCES menu_sections(id),
  name          TEXT NOT NULL,
  description   TEXT,
  dietary_tag   TEXT,
  icon          TEXT NOT NULL,
  image_url     TEXT,
  sort_order    INTEGER NOT NULL,
  category      TEXT,
  is_available  INTEGER NOT NULL DEFAULT 1,
  stock_qty     INTEGER,
  tags_reviewed INTEGER NOT NULL DEFAULT 0
);

-- One-off flags so data migrations run exactly once (e.g. copying the old
-- per-condition seat_preferences columns into seat_conditions).
CREATE TABLE IF NOT EXISTS meta (
  name  TEXT PRIMARY KEY,
  value TEXT
);

-- Ingredient / nutrition tags a dish can carry, and which health conditions
-- forbid which tags. A dish conflicts with a passenger when one of its tags is
-- forbidden by one of the passenger's declared conditions.
CREATE TABLE IF NOT EXISTS restriction_tags (
  tag   TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind  TEXT NOT NULL DEFAULT 'ingredient' CHECK(kind IN ('ingredient','nutrition'))
);

CREATE TABLE IF NOT EXISTS menu_item_tags (
  item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL REFERENCES restriction_tags(tag) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag)
);

CREATE TABLE IF NOT EXISTS health_conditions (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL CHECK(group_name IN ('allergies','intolerances','medicalConditions','other')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  builtin    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS condition_restrictions (
  condition_id TEXT NOT NULL REFERENCES health_conditions(id) ON DELETE CASCADE,
  tag          TEXT NOT NULL REFERENCES restriction_tags(tag) ON DELETE CASCADE,
  PRIMARY KEY (condition_id, tag)
);

-- Source of truth for which conditions a seat has declared (replaces the old
-- one-column-per-condition layout in seat_preferences).
CREATE TABLE IF NOT EXISTS seat_conditions (
  seat_id      TEXT NOT NULL REFERENCES seats(seat_id),
  condition_id TEXT NOT NULL REFERENCES health_conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (seat_id, condition_id)
);

-- Meal orders: one live order per seat, at most one item per category.
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id        TEXT NOT NULL UNIQUE REFERENCES seats(seat_id),
  passenger_name TEXT,
  class_type     TEXT NOT NULL CHECK(class_type IN ('First','Business','Economy')),
  haul_length    TEXT NOT NULL CHECK(haul_length IN ('shortHaul','mediumHaul','longHaul')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','preparing','prepared','delivered','completed')),
  placed_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edit_token     TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK(category IN ('snack','breakfast','lunch','dinner','beverage')),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  PRIMARY KEY (order_id, category)
);

-- Snapshot of the passenger's conditions at order time (no FK on condition_id
-- so renaming/deleting a condition later never rewrites order history).
CREATE TABLE IF NOT EXISTS order_conditions (
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  condition_id TEXT NOT NULL,
  label        TEXT NOT NULL,
  PRIMARY KEY (order_id, condition_id)
);
