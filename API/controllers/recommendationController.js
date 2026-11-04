const { seatExists } = require('../models/seatModel');
const { buildRecommendationContext } = require('../models/recommendationModel');
const { getMealRecommendation } = require('../services/claudeClient');

const VALID_HAUL_LENGTHS = ['shortHaul', 'mediumHaul', 'longHaul'];

async function recommendMealHandler(req, res) {
  const { seatNumber, haulType, selectedMeals } = req.body || {};

  if (typeof seatNumber !== 'string' || !seatNumber) {
    return res.status(400).json({ error: '"seatNumber" is required' });
  }
  if (!seatExists(seatNumber)) {
    return res.status(404).json({ error: `Unknown seat: ${seatNumber}` });
  }
  if (!VALID_HAUL_LENGTHS.includes(haulType)) {
    return res.status(400).json({ error: `"haulType" must be one of ${VALID_HAUL_LENGTHS.join(', ')}` });
  }
  if (selectedMeals !== undefined && !Array.isArray(selectedMeals)) {
    return res.status(400).json({ error: '"selectedMeals" must be an array of meal ids' });
  }

  // Cabin class comes from the real seat record, never from the client —
  // a passenger's request can't claim a class they're not actually seated in.
  const context = buildRecommendationContext(seatNumber, haulType);

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
    res.status(502).json({ error: 'Failed to get a recommendation from the AI service.', detail: err.message });
  }
}

module.exports = { recommendMealHandler };
