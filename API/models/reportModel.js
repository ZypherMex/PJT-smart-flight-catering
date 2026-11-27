const db = require('../db/connection');
const { CATEGORIES, STATUSES, CLASS_TYPES, HAUL_LENGTHS } = require('./orderModel');

const LOW_STOCK_PERCENT = 80; // a limited dish is "low" once this much of its stock is ordered

// Optional cabin-class scope shared by every report query.
function scope(classType, column = 'o.class_type') {
  return classType ? { sql: ` AND ${column} = ?`, params: [classType] } : { sql: '', params: [] };
}

function countsBy(rows, keys) {
  const map = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const { key, count } of rows) map[key] = count;
  return keys.map((key) => ({ key, count: map[key] }));
}

// Everything the Reports tab shows, in one round trip. Whole-flight numbers are
// computed from the live orders, so they are always current.
function getSummary({ classType } = {}) {
  const s = scope(classType);

  const count = (sql) => db.prepare(sql).get(...s.params).count;
  const totals = {
    orders: count(`SELECT COUNT(*) AS count FROM orders o WHERE 1 = 1${s.sql}`),
    items: count(`SELECT COUNT(*) AS count FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE 1 = 1${s.sql}`),
    withConditions: count(
      `SELECT COUNT(*) AS count FROM orders o
       WHERE EXISTS (SELECT 1 FROM order_conditions oc WHERE oc.order_id = o.id)${s.sql}`
    ),
  };

  const byStatus = countsBy(
    db.prepare(`SELECT o.status AS key, COUNT(*) AS count FROM orders o WHERE 1 = 1${s.sql} GROUP BY o.status`).all(...s.params),
    STATUSES
  );
  const byClass = countsBy(
    db.prepare(`SELECT o.class_type AS key, COUNT(*) AS count FROM orders o WHERE 1 = 1${s.sql} GROUP BY o.class_type`).all(...s.params),
    classType ? [classType] : CLASS_TYPES
  );
  const byHaul = countsBy(
    db.prepare(`SELECT o.haul_length AS key, COUNT(*) AS count FROM orders o WHERE 1 = 1${s.sql} GROUP BY o.haul_length`).all(...s.params),
    HAUL_LENGTHS
  );
  const byCategory = countsBy(
    db
      .prepare(
        `SELECT oi.category AS key, COUNT(*) AS count FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE 1 = 1${s.sql} GROUP BY oi.category`
      )
      .all(...s.params),
    CATEGORIES
  );

  const topMeals = db
    .prepare(
      `SELECT mi.id, mi.name, ms.class_type AS classType, ms.haul_length AS haulLength, mi.category, COUNT(*) AS count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE 1 = 1${s.sql}
       GROUP BY mi.id ORDER BY count DESC, mi.name LIMIT 10`
    )
    .all(...s.params);

  const conditions = db
    .prepare(
      `SELECT oc.label, COUNT(*) AS count FROM order_conditions oc JOIN orders o ON o.id = oc.order_id
       WHERE 1 = 1${s.sql} GROUP BY oc.condition_id ORDER BY count DESC, oc.label`
    )
    .all(...s.params);

  const placedAt = db
    .prepare(`SELECT o.placed_at AS placedAt FROM orders o WHERE 1 = 1${s.sql} ORDER BY o.placed_at`)
    .all(...s.params)
    .map((row) => `${row.placedAt.replace(' ', 'T')}Z`); // stored as UTC; the browser buckets by local hour

  return {
    generatedAt: new Date().toISOString(),
    classType: classType || null,
    totals,
    byStatus,
    byClass,
    byHaul,
    byCategory,
    topMeals,
    conditions,
    placedAt,
    inventory: getInventory({ classType }),
  };
}

// Dishes that have a stock limit or are switched off: how much of each is gone.
function getInventory({ classType } = {}) {
  const s = scope(classType, 'ms.class_type');
  const rows = db
    .prepare(
      `SELECT mi.id, mi.name, ms.class_type AS classType, ms.haul_length AS haulLength, mi.category,
              mi.stock_qty AS stock, mi.is_available AS isAvailable,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS used
       FROM menu_items mi JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE (mi.stock_qty IS NOT NULL OR mi.is_available = 0)${s.sql}
       ORDER BY mi.name, ms.class_type`
    )
    .all(...s.params);

  return rows
    .map((row) => {
      const isAvailable = !!row.isAvailable;
      const usedPercent = row.stock === null ? null : row.stock === 0 ? 100 : Math.min(100, Math.round((row.used / row.stock) * 100));
      let state = 'ok';
      if (!isAvailable) state = 'unavailable';
      else if (row.stock !== null && row.used >= row.stock) state = 'soldout';
      else if (usedPercent !== null && usedPercent >= LOW_STOCK_PERCENT) state = 'low';
      return { ...row, isAvailable, usedPercent, remaining: row.stock === null ? null : Math.max(0, row.stock - row.used), state };
    })
    // Most urgent first: gone, then low, then healthy.
    .sort((a, b) => ['unavailable', 'soldout', 'low', 'ok'].indexOf(a.state) - ['unavailable', 'soldout', 'low', 'ok'].indexOf(b.state));
}

// Every dish with how often it was ordered (zeros included) — the Excel "Meal demand" sheet.
function getMealDemand({ classType } = {}) {
  const s = scope(classType, 'ms.class_type');
  return db
    .prepare(
      `SELECT mi.name, ms.class_type AS classType, ms.haul_length AS haulLength, mi.category,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS ordered,
              mi.stock_qty AS stock, mi.is_available AS isAvailable
       FROM menu_items mi JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE 1 = 1${s.sql}
       ORDER BY ordered DESC, ms.class_type, mi.name`
    )
    .all(...s.params)
    .map((row) => ({ ...row, isAvailable: !!row.isAvailable, remaining: row.stock === null ? null : Math.max(0, row.stock - row.ordered) }));
}

module.exports = { getSummary, getInventory, getMealDemand };
