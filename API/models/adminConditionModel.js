const db = require('../db/connection');
const HttpError = require('../utils/HttpError');
const { GROUP_KEYS } = require('./healthConditionModel');
const { RESTRICTION_TAGS } = require('../data/healthConditions');

const MAX_LABEL = 60;
const TAG_KINDS = ['ingredient', 'nutrition'];
const BUILTIN_TAGS = new Set(RESTRICTION_TAGS.map((tag) => tag.tag));

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item';
}

function validateLabel(label) {
  if (typeof label !== 'string' || !label.trim()) throw new HttpError(400, 'A name is required');
  if (label.trim().length > MAX_LABEL) throw new HttpError(400, `Name must be ${MAX_LABEL} characters or fewer`);
  return label.trim();
}

function validateForbids(forbids) {
  if (!Array.isArray(forbids) || !forbids.every((tag) => typeof tag === 'string')) {
    throw new HttpError(400, '"forbids" must be an array of tag names');
  }
  const valid = new Set(db.prepare('SELECT tag FROM restriction_tags').all().map((row) => row.tag));
  const unknown = forbids.find((tag) => !valid.has(tag));
  if (unknown) throw new HttpError(400, `Unknown tag: ${unknown}`);
  return [...new Set(forbids)];
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

function listTags() {
  return db
    .prepare(
      `SELECT rt.tag, rt.label, rt.kind,
              (SELECT COUNT(*) FROM menu_item_tags mit WHERE mit.tag = rt.tag) AS dishCount
       FROM restriction_tags rt ORDER BY rt.kind, rt.label`
    )
    .all()
    .map((row) => ({ ...row, builtin: BUILTIN_TAGS.has(row.tag) }));
}

function createTag({ label, kind }) {
  const cleanLabel = validateLabel(label);
  if (!TAG_KINDS.includes(kind)) throw new HttpError(400, `Kind must be one of ${TAG_KINDS.join(', ')}`);

  const exists = (tag) => !!db.prepare('SELECT 1 FROM restriction_tags WHERE tag = ?').get(tag);
  if (db.prepare('SELECT 1 FROM restriction_tags WHERE LOWER(label) = LOWER(?)').get(cleanLabel)) {
    throw new HttpError(409, `A tag called "${cleanLabel}" already exists`);
  }
  const base = slugify(cleanLabel);
  let tag = base;
  for (let n = 2; exists(tag); n += 1) tag = `${base}_${n}`;

  db.prepare('INSERT INTO restriction_tags (tag, label, kind) VALUES (?, ?, ?)').run(tag, cleanLabel, kind);
  return listTags().find((entry) => entry.tag === tag);
}

function deleteTag(tag) {
  const row = db.prepare('SELECT tag FROM restriction_tags WHERE tag = ?').get(tag);
  if (!row) throw new HttpError(404, `Unknown tag: ${tag}`);
  if (BUILTIN_TAGS.has(tag)) throw new HttpError(409, 'Built-in tags cannot be deleted.');
  // Cascades remove it from every dish and from every condition that forbade it.
  db.prepare('DELETE FROM restriction_tags WHERE tag = ?').run(tag);
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

function listConditions() {
  const conditions = db
    .prepare(
      `SELECT id, label, group_name AS \`group\`, sort_order AS sortOrder, active, builtin,
              (SELECT COUNT(*) FROM seat_conditions sc WHERE sc.condition_id = health_conditions.id) AS seatCount
       FROM health_conditions ORDER BY sort_order, label`
    )
    .all();
  const restrictions = db.prepare('SELECT condition_id AS id, tag FROM condition_restrictions ORDER BY tag').all();
  const byCondition = new Map();
  for (const { id, tag } of restrictions) {
    if (!byCondition.has(id)) byCondition.set(id, []);
    byCondition.get(id).push(tag);
  }
  return conditions.map((condition) => ({
    ...condition,
    active: !!condition.active,
    builtin: !!condition.builtin,
    forbids: byCondition.get(condition.id) || [],
  }));
}

function getCondition(id) {
  return listConditions().find((condition) => condition.id === id) || null;
}

function replaceForbids(id, forbids) {
  db.prepare('DELETE FROM condition_restrictions WHERE condition_id = ?').run(id);
  const insert = db.prepare('INSERT INTO condition_restrictions (condition_id, tag) VALUES (?, ?)');
  for (const tag of forbids) insert.run(id, tag);
}

function assertLabelFree(label, exceptId) {
  const clash = db.prepare('SELECT id FROM health_conditions WHERE LOWER(label) = LOWER(?)').get(label);
  if (clash && clash.id !== exceptId) throw new HttpError(409, `A health condition called "${label}" already exists`);
}

const createTransaction = db.transaction((input) => {
  const label = validateLabel(input.label);
  if (!GROUP_KEYS.includes(input.group)) throw new HttpError(400, `Group must be one of ${GROUP_KEYS.join(', ')}`);
  const forbids = validateForbids(input.forbids === undefined ? [] : input.forbids);
  assertLabelFree(label, null);

  const base = `c_${slugify(label)}`;
  let id = base;
  for (let n = 2; db.prepare('SELECT 1 FROM health_conditions WHERE id = ?').get(id); n += 1) id = `${base}_${n}`;

  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM health_conditions').get();
  db.prepare('INSERT INTO health_conditions (id, label, group_name, sort_order, active, builtin) VALUES (?, ?, ?, ?, 1, 0)').run(
    id,
    label,
    input.group,
    next
  );
  replaceForbids(id, forbids);
  return id;
});

function createCondition(input) {
  if (typeof input !== 'object' || input === null) throw new HttpError(400, 'Request body must be a JSON object');
  return getCondition(createTransaction(input));
}

const updateTransaction = db.transaction((id, input) => {
  const current = getCondition(id);
  if (!current) throw new HttpError(404, `Unknown health condition: ${id}`);

  if (input.label !== undefined) {
    const label = validateLabel(input.label);
    assertLabelFree(label, id);
    db.prepare('UPDATE health_conditions SET label = ? WHERE id = ?').run(label, id);
  }
  if (input.group !== undefined) {
    if (!GROUP_KEYS.includes(input.group)) throw new HttpError(400, `Group must be one of ${GROUP_KEYS.join(', ')}`);
    db.prepare('UPDATE health_conditions SET group_name = ? WHERE id = ?').run(input.group, id);
  }
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw new HttpError(400, '"active" must be true or false');
    db.prepare('UPDATE health_conditions SET active = ? WHERE id = ?').run(input.active ? 1 : 0, id);
  }
  if (input.forbids !== undefined) replaceForbids(id, validateForbids(input.forbids));
});

function updateCondition(id, input) {
  if (typeof input !== 'object' || input === null) throw new HttpError(400, 'Request body must be a JSON object');
  updateTransaction(id, input);
  return getCondition(id);
}

function deleteCondition(id) {
  const condition = getCondition(id);
  if (!condition) throw new HttpError(404, `Unknown health condition: ${id}`);
  if (condition.builtin) {
    throw new HttpError(409, 'Built-in conditions cannot be deleted. Switch them off instead.');
  }
  // Removes it from every seat's saved conditions; past orders keep their own snapshot.
  db.prepare('DELETE FROM health_conditions WHERE id = ?').run(id);
}

module.exports = {
  TAG_KINDS,
  listTags,
  createTag,
  deleteTag,
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
};
