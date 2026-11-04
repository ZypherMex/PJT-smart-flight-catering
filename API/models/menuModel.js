const db = require('../db/connection');

function getMenu(classType, haulLength) {
  const sections = db
    .prepare(
      `SELECT id, section_name AS sectionName
       FROM menu_sections
       WHERE class_type = ? AND haul_length = ?
       ORDER BY sort_order`
    )
    .all(classType, haulLength);

  const getItems = db.prepare(
    `SELECT id, name, description, dietary_tag AS dietaryTag, icon, image_url AS imageUrl
     FROM menu_items
     WHERE section_id = ?
     ORDER BY sort_order`
  );

  return sections.map((section) => ({
    sectionName: section.sectionName,
    items: getItems.all(section.id),
  }));
}

// Flat list of every menu item for a class+haul, across all sections —
// used as the exact `availableMenu` payload sent to Claude, so the AI is
// constrained to real DB rows and the response can be validated against it.
function getFlatMenu(classType, haulLength) {
  return db
    .prepare(
      `SELECT mi.id, mi.name, mi.description
       FROM menu_items mi
       JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE ms.class_type = ? AND ms.haul_length = ?
       ORDER BY ms.sort_order, mi.sort_order`
    )
    .all(classType, haulLength);
}

module.exports = { getMenu, getFlatMenu };
