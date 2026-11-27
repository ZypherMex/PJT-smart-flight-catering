const HttpError = require('../utils/HttpError');
const { CLASS_TYPES, listOrders } = require('../models/orderModel');
const { getSummary, getMealDemand } = require('../models/reportModel');
const { writeOrdersWorkbook, writePdf } = require('../services/exportService');

function parseClassType(raw) {
  if (raw === undefined || raw === '') return undefined;
  if (!CLASS_TYPES.includes(raw)) throw new HttpError(400, `"classType" must be one of ${CLASS_TYPES.join(', ')}`);
  return raw;
}

function summaryHandler(req, res) {
  res.json(getSummary({ classType: parseClassType(req.query.classType) }));
}

async function exportExcelHandler(req, res) {
  const classType = parseClassType(req.query.classType);
  await writeOrdersWorkbook(res, {
    orders: listOrders({ classType }),
    summary: getSummary({ classType }),
    demand: getMealDemand({ classType }),
    classType,
  });
}

function exportPdfHandler(req, res) {
  const classType = parseClassType(req.query.classType);
  writePdf(res, { orders: listOrders({ classType }), summary: getSummary({ classType }), classType });
}

module.exports = { summaryHandler, exportExcelHandler, exportPdfHandler };
