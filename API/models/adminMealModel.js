const db = require('../db/connection');
const HttpError = require('../utils/HttpError');
const { thumbFor } = require('../utils/images');
const { CATEGORIES, CLASS_TYPES, HAUL_LENGTHS } = require('./orderModel');

const DIETARY_TAGS = ['vegetarian', 'healthier'];
const MAX_NAME = 80;
const MAX_DESCRIPTION = 300;
const MAX_STOCK = 9999;

// Dishes are grouped on the Dining page by section; the ordering portal groups
// by category. New dishes (and dishes moved to another category) land in the
// standard section for their category, which is created on demand.
const CATEGORY_SECTION = {
  snack: 'Light Bites',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  beverage: 'Champagne & Wine',
};
const CATEGORY_ICON = { snack: 'sandwich', breakfast: 'egg', lunch: 'chicken', dinner: 'beef', beverage: 'wine' };

const MEAL_SELECT = `
  SELECT mi.id, mi.name, mi.description, mi.dietary_tag AS dietaryTag, mi.icon, mi.image_url AS imageUrl,
         mi.category, mi.is_available AS isAvailable, mi.stock_qty AS stockQty, mi.tags_reviewed AS tagsReviewed,
         ms.id AS sectionId, ms.class_type AS classType, ms.haul_length AS haulLength, ms.section_name AS sectionName,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS used
  FROM menu_items mi
  JOIN menu_sections ms ON ms.id = mi.section_id`;

function shape(row, tagsByItem) {
  return {
    ...row,
    isAvailable: !!row.isAvailable,
    tagsReviewed: !!row.tagsReviewed,
    thumbUrl: thumbFor(row.imageUrl),
    tags: tagsByItem.get(row.id) || [],
  };
}

function loadTags(itemIds) {
  const map = new Map();
  if (!itemIds.length) return map;
  const rows = db
    .prepare(`SELECT item_id AS itemId, tag FROM menu_item_tags WHERE item_id IN (${itemIds.map(() => '?').join(', ')}) ORDER BY tag`)
    .all(...itemIds);
  for (const { itemId, tag } of rows) {
    if (!map.has(itemId)) map.set(itemId, []);
    map.get(itemId).push(tag);
  }
  return map;
}

function listMeals() {
  const rows = db
    .prepare(
      `${MEAL_SELECT}
       ORDER BY CASE ms.class_type WHEN 'First' THEN 0 WHEN 'Business' THEN 1 ELSE 2 END,
                CASE ms.haul_length WHEN 'shortHaul' THEN 0 WHEN 'mediumHaul' THEN 1 ELSE 2 END,
                ms.sort_order, mi.sort_order, mi.id`
    )
    .all();
  const tags = loadTags(rows.map((row) => row.id));
  return rows.map((row) => shape(row, tags));
}

function getMeal(id) {
  const row = db.prepare(`${MEAL_SELECT} WHERE mi.id = ?`).get(id);
  if (!row) return null;
  return shape(row, loadTags([id]));
}

// ---------------------------------------------------------------------------
// Validation — only fields present in the input are returned, so the same
// function serves both create (everything required) and partial update.
// ---------------------------------------------------------------------------

function validTagSet() {
  return new Set(db.prepare('SELECT tag FROM restriction_tags').all().map((row) => row.tag));
}

function validateFields(input, { requireAll }) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  const out = {};
  const has = (key) => input[key] !== undefined;

  if (has('name') || requireAll) {
    if (typeof input.name !== 'string' || !input.name.trim()) throw new HttpError(400, 'Meal name is required');
    if (input.name.trim().length > MAX_NAME) throw new HttpError(400, `Meal name must be ${MAX_NAME} characters or fewer`);
    out.name = input.name.trim();
  }
  if (has('description')) {
    if (input.description !== null && typeof input.description !== 'string') throw new HttpError(400, 'Description must be text');
    const description = (input.description || '').trim();
    if (description.length > MAX_DESCRIPTION) throw new HttpError(400, `Description must be ${MAX_DESCRIPTION} characters or fewer`);
    out.description = description || null;
  }
  if (has('dietaryTag')) {
    if (input.dietaryTag !== null && !DIETARY_TAGS.includes(input.dietaryTag)) {
      throw new HttpError(400, `Dietary tag must be one of ${DIETARY_TAGS.join(', ')} or empty`);
    }
    out.dietaryTag = input.dietaryTag;
  }
  if (has('category') || requireAll) {
    if (!CATEGORIES.includes(input.category)) throw new HttpError(400, `Category must be one of ${CATEGORIES.join(', ')}`);
    out.category = input.category;
  }
  if (has('isAvailable')) {
    if (typeof input.isAvailable !== 'boolean') throw new HttpError(400, '"isAvailable" must be true or false');
    out.isAvailable = input.isAvailable;
  }
  if (has('stockQty')) {
    if (input.stockQty !== null && (!Number.isInteger(input.stockQty) || input.stockQty < 0 || input.stockQty > MAX_STOCK)) {
      throw new HttpError(400, `Stock must be a whole number from 0 to ${MAX_STOCK}, or empty for unlimited`);
    }
    out.stockQty = input.stockQty;
  }
  if (has('tags')) {
    if (!Array.isArray(input.tags) || !input.tags.every((tag) => typeof tag === 'string')) {
      throw new HttpError(400, '"tags" must be an array of tag names');
    }
    const valid = validTagSet();
    const unknown = input.tags.find((tag) => !valid.has(tag));
    if (unknown) throw new HttpError(400, `Unknown tag: ${unknown}`);
    out.tags = [...new Set(input.tags)];
  }
  if (requireAll) {
    if (!CLASS_TYPES.includes(input.classType)) throw new HttpError(400, `Cabin class must be one of ${CLASS_TYPES.join(', ')}`);
    if (!HAUL_LENGTHS.includes(input.haulLength)) throw new HttpError(400, `Flight length must be one of ${HAUL_LENGTHS.join(', ')}`);
    out.classType = input.classType;
    out.haulLength = input.haulLength;
  }
  return out;
}

function findOrCreateSection(classType, haulLength, name) {
  const existing = db
    .prepare('SELECT id FROM menu_sections WHERE class_type = ? AND haul_length = ? AND section_name = ?')
    .get(classType, haulLength, name);
  if (existing) return existing.id;

  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM menu_sections WHERE class_type = ? AND haul_length = ?')
    .get(classType, haulLength);
  return db
    .prepare('INSERT INTO menu_sections (class_type, haul_length, section_name, sort_order) VALUES (?, ?, ?, ?)')
    .run(classType, haulLength, name, next).lastInsertRowid;
}

function replaceTags(itemId, tags) {
  db.prepare('DELETE FROM menu_item_tags WHERE item_id = ?').run(itemId);
  const insert = db.prepare('INSERT INTO menu_item_tags (item_id, tag) VALUES (?, ?)');
  for (const tag of tags) insert.run(itemId, tag);
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

const createTransaction = db.transaction((input) => {
  const fields = validateFields(input, { requireAll: true });
  const sectionId = findOrCreateSection(fields.classType, fields.haulLength, CATEGORY_SECTION[fields.category]);
  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM menu_items WHERE section_id = ?').get(sectionId);

  const itemId = db
    .prepare(
      `INSERT INTO menu_items (section_id, name, description, dietary_tag, icon, image_url, sort_order, category, is_available, stock_qty, tags_reviewed)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)`
    )
    .run(
      sectionId,
      fields.name,
      fields.description ?? null,
      fields.dietaryTag ?? null,
      CATEGORY_ICON[fields.category],
      next,
      fields.category,
      fields.isAvailable === false ? 0 : 1,
      fields.stockQty ?? null
    ).lastInsertRowid;

  replaceTags(itemId, fields.tags || []);
  return itemId;
});

function createMeal(input) {
  return getMeal(createTransaction(input));
}

const updateTransaction = db.transaction((id, input) => {
  const current = getMeal(id);
  if (!current) throw new HttpError(404, `Unknown meal: ${id}`);
  const fields = validateFields(input, { requireAll: false });

  // Class and flight length are fixed once a meal exists; add a new meal instead.
  if (input.classType !== undefined && input.classType !== current.classType) {
    throw new HttpError(400, 'A meal cannot be moved to another cabin class. Add it as a new meal instead.');
  }
  if (input.haulLength !== undefined && input.haulLength !== current.haulLength) {
    throw new HttpError(400, 'A meal cannot be moved to another flight length. Add it as a new meal instead.');
  }

  const assignments = [];
  const values = [];
  const set = (column, value) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (fields.name !== undefined) set('name', fields.name);
  if (fields.description !== undefined) set('description', fields.description);
  if (fields.dietaryTag !== undefined) set('dietary_tag', fields.dietaryTag);
  if (fields.isAvailable !== undefined) set('is_available', fields.isAvailable ? 1 : 0);
  if (fields.stockQty !== undefined) set('stock_qty', fields.stockQty);
  if (fields.category !== undefined && fields.category !== current.category) {
    set('category', fields.category);
    set('section_id', findOrCreateSection(current.classType, current.haulLength, CATEGORY_SECTION[fields.category]));
  }
  if (fields.tags !== undefined) set('tags_reviewed', 1); // staff have looked at this dish's tags

  if (assignments.length) {
    db.prepare(`UPDATE menu_items SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id);
  }
  if (fields.tags !== undefined) replaceTags(id, fields.tags);
});

function updateMeal(id, input) {
  updateTransaction(id, input);
  return getMeal(id);
}

// A dish that is on someone's order can't be deleted (it would corrupt that
// order) — staff should mark it unavailable instead.
function deleteMeal(id) {
  const meal = getMeal(id);
  if (!meal) throw new HttpError(404, `Unknown meal: ${id}`);
  if (meal.used > 0) {
    throw new HttpError(
      409,
      `${meal.name} is on ${meal.used} active order${meal.used === 1 ? '' : 's'}. Mark it unavailable instead of deleting it.`
    );
  }
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  return meal;
}

// '' (not NULL) records "photo removed on purpose": the startup photo sync only
// fills NULLs, so a removed seeded photo is not quietly restored on restart.
function setImageUrl(id, imageUrl) {
  const { changes } = db.prepare('UPDATE menu_items SET image_url = ? WHERE id = ?').run(imageUrl, id);
  if (!changes) throw new HttpError(404, `Unknown meal: ${id}`);
  return getMeal(id);
}

module.exports = {
  CATEGORY_SECTION,
  DIETARY_TAGS,
  listMeals,
  getMeal,
  createMeal,
  updateMeal,
  deleteMeal,
  setImageUrl,
};
