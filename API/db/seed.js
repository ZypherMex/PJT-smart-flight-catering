const db = require('./connection');
const { generateAllSeats } = require('../data/seatGrid');
const { MENU_CATALOG } = require('../data/menuCatalog');

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

module.exports = { seedSeatsIfEmpty, seedMenuIfEmpty };
