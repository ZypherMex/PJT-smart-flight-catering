const HttpError = require('../utils/HttpError');
const { seatExists } = require('../models/seatModel');
const { listConditions } = require('../models/healthConditionModel');
const {
  CLASS_TYPES,
  STATUSES,
  getPortalMenu,
  placeOrUpdateOrder,
  getOrderBySeat,
  listOrders,
  verifyOrderToken,
  setStatus,
  deleteOrder,
} = require('../models/orderModel');
const { emitOrderUpserted, emitOrderDeleted } = require('../realtime/socket');
const { MAX_CONDITIONS } = require('../config');

function parseOrderId(raw) {
  if (!/^\d+$/.test(raw)) throw new HttpError(400, 'Invalid order id');
  return Number(raw);
}

function parseConditionIds(raw) {
  const ids = String(raw || '').split(',').map((id) => id.trim()).filter(Boolean);
  const active = new Set(listConditions().map((condition) => condition.id));
  const unknown = ids.find((id) => !active.has(id));
  if (unknown) throw new HttpError(400, `Unknown health condition: ${unknown}`);
  if (new Set(ids).size > MAX_CONDITIONS) {
    throw new HttpError(400, `You can select at most ${MAX_CONDITIONS} health conditions`);
  }
  return [...new Set(ids)];
}

// ----- Passenger-facing -----

function getPortalMenuHandler(req, res) {
  const { seat, haul } = req.query;
  if (typeof seat !== 'string' || !seat) throw new HttpError(400, '"seat" is required');
  if (!seatExists(seat)) throw new HttpError(404, `Unknown seat: ${seat}`);

  const conditionIds = parseConditionIds(req.query.conditions);

  // A passenger editing their own order must not have their current picks
  // counted against the stock they are about to re-select.
  const own = getOrderBySeat(seat);
  const excludeOrderId = own && verifyOrderToken(seat, req.get('x-order-token')) ? own.id : null;

  res.json(getPortalMenu(seat, haul, conditionIds, excludeOrderId));
}

function placeOrderHandler(req, res) {
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  if (typeof body.seatId !== 'string' || !body.seatId) throw new HttpError(400, '"seatId" is required');

  const result = placeOrUpdateOrder({
    seatId: body.seatId,
    passengerName: body.passengerName,
    haulLength: body.haulLength,
    conditionIds: body.conditions === undefined ? [] : body.conditions,
    selections: body.selections,
    token: req.get('x-order-token'),
  });

  emitOrderUpserted(result.order);
  // The edit token is only ever returned once, to the device that created the order.
  res.status(result.created ? 201 : 200).json(result.created ? { order: result.order, token: result.token } : { order: result.order });
}

function getMyOrderHandler(req, res) {
  const { seatId } = req.params;
  if (!seatExists(seatId)) throw new HttpError(404, `Unknown seat: ${seatId}`);
  const order = getOrderBySeat(seatId);
  if (!order) throw new HttpError(404, 'No order for this seat yet');
  if (!verifyOrderToken(seatId, req.get('x-order-token'))) {
    throw new HttpError(403, 'This order belongs to another device');
  }
  res.json({ order });
}

// ----- Crew-facing (behind requireCrew) -----

function listOrdersHandler(req, res) {
  const { search, classType, condition, status } = req.query;
  if (search !== undefined && (typeof search !== 'string' || search.length > 10)) {
    throw new HttpError(400, 'Invalid search');
  }
  if (classType && !CLASS_TYPES.includes(classType)) {
    throw new HttpError(400, `"classType" must be one of ${CLASS_TYPES.join(', ')}`);
  }
  if (status && !STATUSES.includes(status)) {
    throw new HttpError(400, `"status" must be one of ${STATUSES.join(', ')}`);
  }
  if (condition !== undefined && typeof condition !== 'string') {
    throw new HttpError(400, 'Invalid condition filter');
  }
  res.json({ orders: listOrders({ search, classType, conditionId: condition, status }) });
}

function updateStatusHandler(req, res) {
  const order = setStatus(parseOrderId(req.params.id), (req.body || {}).status);
  emitOrderUpserted(order);
  res.json({ order });
}

function deleteOrderHandler(req, res) {
  const order = deleteOrder(parseOrderId(req.params.id));
  emitOrderDeleted(order);
  res.json({ ok: true });
}

module.exports = {
  getPortalMenuHandler,
  placeOrderHandler,
  getMyOrderHandler,
  listOrdersHandler,
  updateStatusHandler,
  deleteOrderHandler,
};
