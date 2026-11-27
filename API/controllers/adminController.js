const HttpError = require('../utils/HttpError');
const meals = require('../models/adminMealModel');
const conditions = require('../models/adminConditionModel');
const { CATEGORIES, CLASS_TYPES, HAUL_LENGTHS } = require('../models/orderModel');
const { GROUP_KEYS } = require('../models/healthConditionModel');
const { saveMealImage, deleteGeneratedImage } = require('../services/imageService');
const { emitMenuChanged } = require('../realtime/socket');

function parseId(raw) {
  if (!/^\d+$/.test(raw)) throw new HttpError(400, 'Invalid id');
  return Number(raw);
}

// Everything the admin forms need to build their dropdowns and tag pickers.
function getMeta(req, res) {
  res.json({
    classTypes: CLASS_TYPES,
    haulLengths: HAUL_LENGTHS,
    categories: CATEGORIES,
    dietaryTags: meals.DIETARY_TAGS,
    conditionGroups: GROUP_KEYS,
    tags: conditions.listTags(),
  });
}

// ----- Meals -----

function listMealsHandler(req, res) {
  res.json({ meals: meals.listMeals() });
}

function createMealHandler(req, res) {
  const meal = meals.createMeal(req.body);
  emitMenuChanged();
  res.status(201).json({ meal });
}

function updateMealHandler(req, res) {
  const meal = meals.updateMeal(parseId(req.params.id), req.body);
  emitMenuChanged();
  res.json({ meal });
}

async function deleteMealHandler(req, res) {
  const meal = meals.deleteMeal(parseId(req.params.id));
  await deleteGeneratedImage(meal.imageUrl);
  emitMenuChanged();
  res.json({ ok: true });
}

async function uploadMealImageHandler(req, res) {
  const id = parseId(req.params.id);
  const before = meals.getMeal(id);
  if (!before) throw new HttpError(404, `Unknown meal: ${id}`);
  if (!req.file) throw new HttpError(400, 'Choose an image file to upload');

  const { imageUrl } = await saveMealImage(req.file.buffer);
  const meal = meals.setImageUrl(id, imageUrl);
  await deleteGeneratedImage(before.imageUrl); // replaced photo; seeded originals are never deleted
  emitMenuChanged();
  res.json({ meal });
}

async function removeMealImageHandler(req, res) {
  const id = parseId(req.params.id);
  const before = meals.getMeal(id);
  if (!before) throw new HttpError(404, `Unknown meal: ${id}`);

  const meal = meals.setImageUrl(id, '');
  await deleteGeneratedImage(before.imageUrl);
  emitMenuChanged();
  res.json({ meal });
}

// ----- Health rules -----

function listConditionsHandler(req, res) {
  res.json({ conditions: conditions.listConditions(), tags: conditions.listTags() });
}

function createConditionHandler(req, res) {
  res.status(201).json({ condition: conditions.createCondition(req.body) });
}

function updateConditionHandler(req, res) {
  res.json({ condition: conditions.updateCondition(req.params.id, req.body) });
}

function deleteConditionHandler(req, res) {
  conditions.deleteCondition(req.params.id);
  res.json({ ok: true });
}

function createTagHandler(req, res) {
  res.status(201).json({ tag: conditions.createTag(req.body || {}) });
}

function deleteTagHandler(req, res) {
  conditions.deleteTag(req.params.tag);
  res.json({ ok: true });
}

module.exports = {
  getMeta,
  listMealsHandler,
  createMealHandler,
  updateMealHandler,
  deleteMealHandler,
  uploadMealImageHandler,
  removeMealImageHandler,
  listConditionsHandler,
  createConditionHandler,
  updateConditionHandler,
  deleteConditionHandler,
  createTagHandler,
  deleteTagHandler,
};
