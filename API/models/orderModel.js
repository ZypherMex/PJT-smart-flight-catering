const crypto = require('crypto');
const db = require('../db/connection');
const HttpError = require('../utils/HttpError');
const { thumbFor } = require('../utils/images');
const { getSeat } = require('./seatModel');
const { listConditions } = require('./healthConditionModel');
const { getConflicts } = require('./compatibilityModel');
const { upsertPreferences } = require('./preferenceModel');
const { MAX_CONDITIONS } = require('../config');

const CATEGORIES = ['snack', 'breakfast', 'lunch', 'dinner', 'beverage'];
const STATUSES = ['pending', 'preparing', 'prepared', 'delivered', 'completed'];
const HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];
const CLASS_TYPES = ['First', 'Business', 'Economy'];
const MAX_NAME_LENGTH = 60;

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Reading orders
// ---------------------------------------------------------------------------

const ORDER_SELECT = `
  SELECT o.id, o.seat_id AS seatId, s.row_number AS row, s.seat_letter AS letter,
         o.passenger_name AS passengerName, o.class_type AS classType,
         o.haul_length AS haulLength, o.status, o.placed_at AS placedAt, o.updated_at AS updatedAt
  FROM orders o
  JOIN seats s ON s.seat_id = o.seat_id`;

// Attaches each order's meals (one slot per category, null when not ordered)
// and the conditions snapshotted at order time. Never exposes edit_token.
function buildOrders(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');

  const items = db
    .prepare(
      `SELECT oi.order_id AS orderId, oi.category, mi.id, mi.name, mi.image_url AS imageUrl
       FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id IN (${placeholders})`
    )
    .all(...ids);
  const conditions = db
    .prepare(
      `SELECT order_id AS orderId, condition_id AS id, label
       FROM order_conditions WHERE order_id IN (${placeholders}) ORDER BY label`
    )
    .all(...ids);

  const byOrder = new Map(
    rows.map((row) => [
      row.id,
      { ...row, items: Object.fromEntries(CATEGORIES.map((category) => [category, null])), conditions: [] },
    ])
  );
  for (const item of items) {
    byOrder.get(item.orderId).items[item.category] = {
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      thumbUrl: thumbFor(item.imageUrl),
    };
  }
  for (const condition of conditions) {
    byOrder.get(condition.orderId).conditions.push({ id: condition.id, label: condition.label });
  }
  return rows.map((row) => byOrder.get(row.id));
}

function getOrderById(orderId) {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId);
  return row ? buildOrders([row])[0] : null;
}

function getOrderBySeat(seatId) {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.seat_id = ?`).get(seatId);
  return row ? buildOrders([row])[0] : null;
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function listOrders({ search, classType, conditionId, status } = {}) {
  const where = [];
  const params = [];
  if (search) {
    where.push("o.seat_id LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(search)}%`);
  }
  if (classType) {
    where.push('o.class_type = ?');
    params.push(classType);
  }
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (conditionId) {
    where.push('EXISTS (SELECT 1 FROM order_conditions oc WHERE oc.order_id = o.id AND oc.condition_id = ?)');
    params.push(conditionId);
  }
  const rows = db
    .prepare(
      `${ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.row_number, s.seat_letter`
    )
    .all(...params);
  return buildOrders(rows);
}

function verifyOrderToken(seatId, token) {
  const row = db.prepare('SELECT edit_token FROM orders WHERE seat_id = ?').get(seatId);
  return !!row && safeEqual(row.edit_token, token);
}

// ---------------------------------------------------------------------------
// The passenger's menu: five categories for their class + haul, with each dish
// flagged sold-out / conflicting so the UI can grey it out and say why.
// ---------------------------------------------------------------------------

function isSoldOut(item, used) {
  return !item.isAvailable || (item.stockQty !== null && used >= item.stockQty);
}

function getPortalMenu(seatId, haulLength, conditionIds = [], excludeOrderId = null) {
  const seat = getSeat(seatId);
  if (!seat) throw new HttpError(404, `Unknown seat: ${seatId}`);
  if (!HAUL_LENGTHS.includes(haulLength)) {
    throw new HttpError(400, `"haul" must be one of ${HAUL_LENGTHS.join(', ')}`);
  }

  const rows = db
    .prepare(
      `SELECT mi.id, mi.name, mi.description, mi.dietary_tag AS dietaryTag, mi.image_url AS imageUrl,
              mi.category, mi.is_available AS isAvailable, mi.stock_qty AS stockQty,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.menu_item_id = mi.id AND oi.order_id IS NOT ?) AS used
       FROM menu_items mi
       JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE ms.class_type = ? AND ms.haul_length = ? AND mi.category IS NOT NULL
       ORDER BY ms.sort_order, mi.sort_order`
    )
    .all(excludeOrderId, seat.classType, haulLength);

  const categories = CATEGORIES.map((category) => ({
    category,
    items: rows
      .filter((row) => row.category === category)
      .map((row) => ({
        id: row.id,
        category: row.category,
        name: row.name,
        description: row.description,
        dietaryTag: row.dietaryTag,
        imageUrl: row.imageUrl,
        thumbUrl: thumbFor(row.imageUrl),
        soldOut: isSoldOut(row, row.used),
        remaining: row.stockQty === null ? null : Math.max(0, row.stockQty - row.used),
        conflicts: getConflicts(row.id, conditionIds),
      })),
  }));

  return { seat, haulLength, categories };
}

// ---------------------------------------------------------------------------
// Placing / editing an order. Everything runs in one transaction; better-sqlite3
// is synchronous, so the stock check and the write cannot interleave with
// another request.
// ---------------------------------------------------------------------------

function validateInput(input, seat) {
  const { passengerName, haulLength, conditionIds, selections } = input;

  if (!HAUL_LENGTHS.includes(haulLength)) {
    throw new HttpError(400, `"haulLength" must be one of ${HAUL_LENGTHS.join(', ')}`);
  }

  let name = null;
  if (passengerName !== undefined && passengerName !== null) {
    if (typeof passengerName !== 'string') throw new HttpError(400, '"passengerName" must be text');
    name = passengerName.trim().slice(0, MAX_NAME_LENGTH) || null;
  }

  if (!Array.isArray(conditionIds) || !conditionIds.every((id) => typeof id === 'string')) {
    throw new HttpError(400, '"conditions" must be an array of condition ids');
  }
  const uniqueConditionIds = [...new Set(conditionIds)];
  const activeConditions = new Map(listConditions().map((condition) => [condition.id, condition]));
  const unknown = uniqueConditionIds.find((id) => !activeConditions.has(id));
  if (unknown) throw new HttpError(400, `Unknown health condition: ${unknown}`);
  if (uniqueConditionIds.length > MAX_CONDITIONS) {
    throw new HttpError(400, `You can select at most ${MAX_CONDITIONS} health conditions`);
  }

  if (typeof selections !== 'object' || selections === null || Array.isArray(selections)) {
    throw new HttpError(400, '"selections" must be an object of category -> meal id');
  }
  const picks = [];
  for (const [category, itemId] of Object.entries(selections)) {
    if (!CATEGORIES.includes(category)) throw new HttpError(400, `Unknown category: ${category}`);
    if (itemId === null || itemId === undefined) continue;
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new HttpError(400, `Invalid meal id for ${category}`);
    }
    picks.push({ category, itemId });
  }
  if (!picks.length) throw new HttpError(400, 'Select at least one meal before placing your order');

  return { name, haulLength, conditions: uniqueConditionIds.map((id) => activeConditions.get(id)), picks, seat };
}

const placeTransaction = db.transaction((input) => {
  const seat = getSeat(input.seatId);
  if (!seat) throw new HttpError(404, `Unknown seat: ${input.seatId}`);
  const { name, haulLength, conditions, picks } = validateInput(input, seat);

  const existing = db.prepare('SELECT * FROM orders WHERE seat_id = ?').get(seat.seatId);
  if (existing) {
    if (!safeEqual(existing.edit_token, input.token)) {
      throw new HttpError(
        403,
        'This seat already has an order. Use the device that placed it, or ask the cabin crew for help.'
      );
    }
    if (existing.status !== 'pending') {
      throw new HttpError(409, 'Your order is already being prepared and can no longer be changed.');
    }
  }

  const problems = [];
  const resolved = [];
  const usageStatement = db.prepare(
    'SELECT COUNT(*) AS used FROM order_items WHERE menu_item_id = ? AND order_id IS NOT ?'
  );
  const itemStatement = db.prepare(
    `SELECT mi.id, mi.name, mi.category, mi.is_available AS isAvailable, mi.stock_qty AS stockQty,
            ms.class_type AS classType, ms.haul_length AS haulLength
     FROM menu_items mi JOIN menu_sections ms ON ms.id = mi.section_id WHERE mi.id = ?`
  );
  const conditionIds = conditions.map((condition) => condition.id);

  for (const { category, itemId } of picks) {
    const item = itemStatement.get(itemId);
    if (!item || item.classType !== seat.classType || item.haulLength !== haulLength) {
      throw new HttpError(400, `Meal ${itemId} is not on the ${seat.classType} menu for this flight`);
    }
    if (item.category !== category) {
      throw new HttpError(400, `${item.name} is not a ${category} item`);
    }

    const { used } = usageStatement.get(itemId, existing ? existing.id : null);
    if (isSoldOut(item, used)) {
      problems.push({ category, itemId, itemName: item.name, reason: 'sold_out', message: `${item.name} is no longer available.` });
      continue;
    }

    const conflicts = getConflicts(itemId, conditionIds);
    if (conflicts.length) {
      problems.push({
        category,
        itemId,
        itemName: item.name,
        reason: 'health_conflict',
        message: conflicts.map((conflict) => conflict.message).join(' '),
        conflicts,
      });
      continue;
    }
    resolved.push({ category, itemId });
  }

  if (problems.length) {
    throw new HttpError(422, 'Some selected meals cannot be ordered', { problems });
  }

  let orderId;
  let token;
  if (existing) {
    orderId = existing.id;
    token = existing.edit_token;
    db.prepare(
      `UPDATE orders SET passenger_name = ?, class_type = ?, haul_length = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, seat.classType, haulLength, orderId);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_conditions WHERE order_id = ?').run(orderId);
  } else {
    token = crypto.randomBytes(16).toString('hex');
    orderId = db
      .prepare('INSERT INTO orders (seat_id, passenger_name, class_type, haul_length, edit_token) VALUES (?, ?, ?, ?, ?)')
      .run(seat.seatId, name, seat.classType, haulLength, token).lastInsertRowid;
  }

  const insertItem = db.prepare('INSERT INTO order_items (order_id, category, menu_item_id) VALUES (?, ?, ?)');
  for (const { category, itemId } of resolved) insertItem.run(orderId, category, itemId);

  const insertCondition = db.prepare('INSERT INTO order_conditions (order_id, condition_id, label) VALUES (?, ?, ?)');
  for (const condition of conditions) insertCondition.run(orderId, condition.id, condition.label);

  // Keep the seat map / AI recommendation view of this seat in step with what
  // the passenger just declared.
  const checks = {};
  for (const condition of conditions) {
    (checks[condition.groupName] ||= []).push(condition.label);
  }
  upsertPreferences(seat.seatId, { checks, haulLength });

  return { orderId, token, created: !existing };
});

function placeOrUpdateOrder(input) {
  const { orderId, token, created } = placeTransaction(input);
  return { order: getOrderById(orderId), token, created };
}

// ---------------------------------------------------------------------------
// Crew actions
// ---------------------------------------------------------------------------

function setStatus(orderId, status) {
  if (!STATUSES.includes(status)) {
    throw new HttpError(400, `"status" must be one of ${STATUSES.join(', ')}`);
  }
  const { changes } = db
    .prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, orderId);
  if (!changes) throw new HttpError(404, `Unknown order: ${orderId}`);
  return getOrderById(orderId);
}

// Releases a seat (order items/conditions cascade away) so it can order afresh.
function deleteOrder(orderId) {
  const order = getOrderById(orderId);
  if (!order) throw new HttpError(404, `Unknown order: ${orderId}`);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  return order;
}

module.exports = {
  CATEGORIES,
  STATUSES,
  CLASS_TYPES,
  HAUL_LENGTHS,
  getPortalMenu,
  placeOrUpdateOrder,
  getOrderById,
  getOrderBySeat,
  listOrders,
  verifyOrderToken,
  setStatus,
  deleteOrder,
};
