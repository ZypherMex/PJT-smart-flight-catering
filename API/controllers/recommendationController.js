const HttpError = require('../utils/HttpError');
const { seatExists } = require('../models/seatModel');
const { resolveConditions } = require('../models/healthConditionModel');
const { buildRecommendationContext } = require('../models/recommendationModel');
const { getMealRecommendation } = require('../services/claudeClient');
const { isAiConfigured } = require('../services/aiConfig');

const VALID_HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];

// Body: { seatNumber, haulType, conditions: [conditionId...], selectedMeals?: [mealId...] }
async function recommendMealHandler(req, res) {
  if (!isAiConfigured()) {
    throw new HttpError(503, 'Meal suggestions are not set up on this server. You can still choose from the menu.', { code: 'ai_not_configured' });
  }
  const { seatNumber, haulType, conditions, selectedMeals } = req.body || {};

  if (typeof seatNumber !== 'string' || !seatNumber) throw new HttpError(400, '"seatNumber" is required');
  if (!seatExists(seatNumber)) throw new HttpError(404, `Unknown seat: ${seatNumber}`);
  if (!VALID_HAUL_LENGTHS.includes(haulType)) {
    throw new HttpError(400, `"haulType" must be one of ${VALID_HAUL_LENGTHS.join(', ')}`);
  }
  if (selectedMeals !== undefined && !(Array.isArray(selectedMeals) && selectedMeals.every(Number.isInteger))) {
    throw new HttpError(400, '"selectedMeals" must be an array of meal ids');
  }

  // Cabin class comes from the real seat record, never from the client.
  const context = buildRecommendationContext(seatNumber, haulType, resolveConditions(conditions === undefined ? [] : conditions));

  if (!context.availableMenu.length) {
    return res.json({
      recommendedMeals: [],
      summary: 'No meal on this menu is available and compatible with the declared health conditions.',
      confidence: null,
    });
  }

  try {
    const recommendation = await getMealRecommendation({
      flightClass: context.flightClass,
      haulLength: context.haulLength,
      healthConditions: context.healthConditions,
      selectedMeals,
      availableMenu: context.availableMenu,
    });
    res.json(recommendation);
  } catch (err) {
    console.error('Meal recommendation failed:', err);
    // The detail stays in the server log; passengers get a plain message.
    throw new HttpError(502, 'The meal suggestion service is not available right now. You can still choose from the menu.');
  }
}

module.exports = { recommendMealHandler };
