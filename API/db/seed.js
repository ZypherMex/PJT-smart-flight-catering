const db = require('./connection');
const { generateAllSeats } = require('../data/seatGrid');
const { MENU_CATALOG } = require('../data/menuCatalog');

// CREATE TABLE IF NOT EXISTS (in schema.sql) never adds columns to a table
// that already exists, so a DB created before haul_length/meal_time existed
// needs them added by hand, once, on startup.
function migrateSeatPreferencesColumns() {
  const columns = db.prepare('PRAGMA table_info(seat_preferences)').all().map((col) => col.name);
  if (!columns.includes('haul_length')) {
    db.exec('ALTER TABLE seat_preferences ADD COLUMN haul_length TEXT');
  }
  if (!columns.includes('meal_time')) {
    db.exec('ALTER TABLE seat_preferences ADD COLUMN meal_time TEXT');
  }
}

function seedSeatsIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM seats').get();
  if (count > 0) return count;

  const insert = db.prepare(
    'INSERT INTO seats (seat_id, row_number, seat_letter, class_type) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((seats) => {
    for (const seat of seats) {
      insert.run(seat.seatId, seat.row, seat.letter, seat.classType);
    }
  });

  const seats = generateAllSeats();
  insertMany(seats);
  return seats.length;
}

function seedMenuIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get();
  if (count > 0) return count;

  const insertSection = db.prepare(
    'INSERT INTO menu_sections (class_type, haul_length, section_name, sort_order) VALUES (?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO menu_items (section_id, name, description, dietary_tag, icon, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  let itemCount = 0;

  const insertAll = db.transaction(() => {
    for (const [classType, haulMap] of Object.entries(MENU_CATALOG)) {
      for (const [haulLength, sections] of Object.entries(haulMap)) {
        sections.forEach((section, sectionIndex) => {
          const { lastInsertRowid: sectionId } = insertSection.run(
            classType,
            haulLength,
            section.section,
            sectionIndex
          );
          section.items.forEach((dish, itemIndex) => {
            insertItem.run(
              sectionId,
              dish.name,
              dish.description || null,
              dish.dietaryTag || null,
              dish.icon,
              dish.imageUrl || null,
              itemIndex
            );
            itemCount += 1;
          });
        });
      }
    }
  });

  insertAll();
  return itemCount;
}

// Runs every startup (not just on first seed) so a photo added to
// menuCatalog.js later shows up immediately, without wiping the menu table.
// Only fills dishes that have no photo yet, so images uploaded or changed
// through the admin area are never overwritten.
function syncMenuImages() {
  const update = db.prepare('UPDATE menu_items SET image_url = ? WHERE name = ? AND image_url IS NULL');
  let updated = 0;

  const updateAll = db.transaction(() => {
    for (const haulMap of Object.values(MENU_CATALOG)) {
      for (const sections of Object.values(haulMap)) {
        for (const section of sections) {
          for (const dish of section.items) {
            if (!dish.imageUrl) continue;
            const { changes } = update.run(dish.imageUrl, dish.name);
            updated += changes;
          }
        }
      }
    }
  });

  updateAll();
  return updated;
}

module.exports = { migrateSeatPreferencesColumns, seedSeatsIfEmpty, seedMenuIfEmpty, syncMenuImages };
