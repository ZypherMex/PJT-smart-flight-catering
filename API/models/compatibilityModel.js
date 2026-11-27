const db = require('../db/connection');

function messageFor(tagLabel, kind, conditionLabel) {
  const what = kind === 'nutrition' ? `High in ${tagLabel.toLowerCase()}` : `Contains ${tagLabel.toLowerCase()}`;
  return `${what} — not suitable with ${conditionLabel}.`;
}

// Which of the given conditions does this dish conflict with, and why?
// conditionIds are health_conditions.id values. Returns [] when the dish is fine.
function getConflicts(itemId, conditionIds) {
  if (!conditionIds.length) return [];
  const placeholders = conditionIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT hc.id AS conditionId, hc.label AS conditionLabel, rt.tag, rt.label AS tagLabel, rt.kind
       FROM menu_item_tags mit
       JOIN condition_restrictions cr ON cr.tag = mit.tag
       JOIN health_conditions hc ON hc.id = cr.condition_id
       JOIN restriction_tags rt ON rt.tag = mit.tag
       WHERE mit.item_id = ? AND cr.condition_id IN (${placeholders})
       ORDER BY hc.sort_order, rt.tag`
    )
    .all(itemId, ...conditionIds);

  return rows.map((row) => ({
    conditionId: row.conditionId,
    condition: row.conditionLabel,
    tag: row.tag,
    message: messageFor(row.tagLabel, row.kind, row.conditionLabel),
  }));
}

function checkItem(itemId, conditionIds) {
  const conflicts = getConflicts(itemId, conditionIds);
  return { ok: conflicts.length === 0, conflicts };
}

// Many dishes at once (the portal menu): { [itemId]: conflicts[] } with only
// conflicting dishes present.
function getConflictsForItems(itemIds, conditionIds) {
  const result = {};
  if (!conditionIds.length) return result;
  for (const itemId of itemIds) {
    const conflicts = getConflicts(itemId, conditionIds);
    if (conflicts.length) result[itemId] = conflicts;
  }
  return result;
}

module.exports = { checkItem, getConflicts, getConflictsForItems };
