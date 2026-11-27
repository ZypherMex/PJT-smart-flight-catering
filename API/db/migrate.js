const db = require('./connection');
const { RESTRICTION_TAGS, BUILTIN_CONDITIONS, inferItemTags } = require('../data/healthConditions');
const { MAX_CONDITIONS } = require('../config');

function columnNames(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function addColumnIfMissing(table, column, definition) {
  if (!columnNames(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// CREATE TABLE IF NOT EXISTS never adds columns to a table that already exists,
// so databases created before ordering existed need these added by hand.
function migrateMenuColumns() {
  addColumnIfMissing('menu_items', 'category', 'TEXT');
  addColumnIfMissing('menu_items', 'is_available', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('menu_items', 'stock_qty', 'INTEGER');
  addColumnIfMissing('menu_items', 'tags_reviewed', 'INTEGER NOT NULL DEFAULT 0');
}

// The orders table shipped without edit_token; it carries no data yet, so a
// plain nullable column is enough.
function migrateOrderColumns() {
  addColumnIfMissing('orders', 'edit_token', 'TEXT');
}

// Maps the menu's existing section names onto the five ordering categories.
// Only fills rows with no category yet, so admin edits are never overwritten.
function backfillMenuCategories() {
  const { changes } = db
    .prepare(
      `UPDATE menu_items SET category = (
         SELECT CASE ms.section_name
                  WHEN 'Light Bites' THEN 'snack'
                  WHEN 'Breakfast' THEN 'breakfast'
                  WHEN 'Lunch' THEN 'lunch'
                  WHEN 'Champagne & Wine' THEN 'beverage'
                  ELSE 'dinner'
                END
         FROM menu_sections ms WHERE ms.id = menu_items.section_id
       )
       WHERE category IS NULL`
    )
    .run();
  return changes;
}

function seedHealthConditionsIfEmpty() {
  const insertTag = db.prepare('INSERT OR IGNORE INTO restriction_tags (tag, label, kind) VALUES (?, ?, ?)');
  for (const t of RESTRICTION_TAGS) insertTag.run(t.tag, t.label, t.kind);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM health_conditions').get();
  if (count > 0) return 0;

  const insertCondition = db.prepare(
    'INSERT INTO health_conditions (id, label, group_name, sort_order, active, builtin) VALUES (?, ?, ?, ?, 1, 1)'
  );
  const insertRestriction = db.prepare('INSERT INTO condition_restrictions (condition_id, tag) VALUES (?, ?)');

  db.transaction(() => {
    BUILTIN_CONDITIONS.forEach((c, index) => {
      insertCondition.run(c.id, c.label, c.group, index);
      for (const tag of c.forbids) insertRestriction.run(c.id, tag);
    });
  })();
  return BUILTIN_CONDITIONS.length;
}

// One-time copy of the old one-column-per-condition layout into seat_conditions.
// Guarded by a meta flag: without it, a seat whose conditions were later all
// cleared would have its old column values resurrected on the next startup.
function migrateSeatConditionsFromColumns() {
  const done = db.prepare("SELECT 1 FROM meta WHERE name = 'seat_conditions_migrated'").get();
  if (done) return 0;

  const existingColumns = columnNames('seat_preferences');
  let copied = 0;

  db.transaction(() => {
    for (const condition of BUILTIN_CONDITIONS) {
      if (!existingColumns.includes(condition.id)) continue;
      const { changes } = db
        .prepare(
          `INSERT OR IGNORE INTO seat_conditions (seat_id, condition_id)
           SELECT seat_id, ? FROM seat_preferences WHERE ${condition.id} = 1`
        )
        .run(condition.id);
      copied += changes;
    }
    db.prepare("INSERT INTO meta (name, value) VALUES ('seat_conditions_migrated', '1')").run();
  })();

  return copied;
}

// The old randomizer could tick every condition on a seat. Trim those down to
// the cap once, keeping the earliest conditions in display order (allergies
// first, as they are the most safety-critical). Flagged so it never runs again.
function capSeatConditionsOnce() {
  const done = db.prepare("SELECT 1 FROM meta WHERE name = 'seat_conditions_capped'").get();
  if (done) return 0;

  let removed = 0;
  db.transaction(() => {
    ({ changes: removed } = db
      .prepare(
        `DELETE FROM seat_conditions WHERE rowid IN (
           SELECT rid FROM (
             SELECT sc.rowid AS rid,
                    ROW_NUMBER() OVER (PARTITION BY sc.seat_id ORDER BY hc.sort_order) AS rn
             FROM seat_conditions sc
             JOIN health_conditions hc ON hc.id = sc.condition_id
           ) WHERE rn > ?
         )`
      )
      .run(MAX_CONDITIONS));
    db.prepare("INSERT INTO meta (name, value) VALUES ('seat_conditions_capped', '1')").run();
  })();
  return removed;
}

// Gives every not-yet-reviewed, not-yet-tagged dish its inferred tags. Dishes
// staff have reviewed (tags_reviewed = 1) or already tagged are left alone.
function tagUnreviewedMenuItems() {
  const items = db
    .prepare(
      `SELECT id, name, description, icon FROM menu_items
       WHERE tags_reviewed = 0 AND id NOT IN (SELECT item_id FROM menu_item_tags)`
    )
    .all();
  const insert = db.prepare('INSERT OR IGNORE INTO menu_item_tags (item_id, tag) VALUES (?, ?)');

  let tagged = 0;
  db.transaction(() => {
    for (const item of items) {
      for (const tag of inferItemTags(item)) {
        insert.run(item.id, tag);
        tagged += 1;
      }
    }
  })();
  return tagged;
}

module.exports = {
  migrateMenuColumns,
  migrateOrderColumns,
  backfillMenuCategories,
  seedHealthConditionsIfEmpty,
  migrateSeatConditionsFromColumns,
  capSeatConditionsOnce,
  tagUnreviewedMenuItems,
};
